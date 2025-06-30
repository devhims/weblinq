import { DurableObject } from 'cloudflare:workers';
import { Buffer } from 'node:buffer';

/**
 * MonitoringDO - Automated API endpoint monitoring with SQLite storage
 *
 * Features:
 * - Periodic testing of all API endpoints using alarm API
 * - Metrics collection (response time, success rate, error details)
 * - SQLite storage for historical analysis
 * - Configurable test intervals and parameters
 * - Start/stop control via exposed endpoints
 */
export class MonitoringDO extends DurableObject<CloudflareBindings> {
  private sql: SqlStorage | null = null;
  private sqlEnabled: boolean = false;
  private isTestingActive: boolean = false;
  private testConfig: TestConfiguration;

  // Default test configuration
  private defaultConfig: TestConfiguration = {
    intervalMs: 5 * 60 * 1000, // 5 minutes
    apiBaseUrl: 'https://api.weblinq.dev',
    apiKey: '', // Will be set from env or config
    timeoutMs: 30000, // 30 seconds per test
    enabledEndpoints: ['screenshot', 'markdown', 'content', 'scrape', 'links', 'search', 'pdf'],
  };

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);
    this.testConfig = { ...this.defaultConfig };

    console.log('MonitoringDO: 🏗️ constructor - initializing monitoring system');

    // Initialize SQLite and restore state
    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeDatabase();
      await this.restoreState();
    });
  }

  /**
   * Initialize SQLite database for storing test results
   */
  private async initializeDatabase(): Promise<void> {
    try {
      this.sql = this.ctx.storage.sql;
      console.log('✅ SQLite storage API accessible - testing database operations...');

      // Test basic SQL access
      const cursor = this.sql.exec(`PRAGMA table_list`);
      const tables = [...cursor].map((row: any) => row.name);
      console.log('📋 Existing tables:', tables);

      // Create tables if they don't exist
      if (!tables.includes('test_results')) {
        console.log('🔧 Creating monitoring tables...');

        this.sql.exec(`
          -- Main test results table
          CREATE TABLE IF NOT EXISTS test_results (
            id TEXT PRIMARY KEY,
            endpoint TEXT NOT NULL,
            test_url TEXT NOT NULL,
            success BOOLEAN NOT NULL,
            response_time_ms INTEGER NOT NULL,
            status_code INTEGER,
            error_message TEXT,
            response_size INTEGER,
            credits_cost INTEGER,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            test_config TEXT -- JSON string of test parameters
          );

          -- Test session summary table
          CREATE TABLE IF NOT EXISTS test_sessions (
            id TEXT PRIMARY KEY,
            start_time TEXT NOT NULL DEFAULT (datetime('now')),
            end_time TEXT,
            total_tests INTEGER DEFAULT 0,
            successful_tests INTEGER DEFAULT 0,
            failed_tests INTEGER DEFAULT 0,
            avg_response_time_ms REAL,
            config TEXT -- JSON string of session config
          );

          -- Endpoint performance summary
          CREATE TABLE IF NOT EXISTS endpoint_stats (
            endpoint TEXT PRIMARY KEY,
            total_tests INTEGER DEFAULT 0,
            successful_tests INTEGER DEFAULT 0,
            failed_tests INTEGER DEFAULT 0,
            avg_response_time_ms REAL,
            min_response_time_ms INTEGER,
            max_response_time_ms INTEGER,
            last_success_time TEXT,
            last_failure_time TEXT,
            last_updated TEXT DEFAULT (datetime('now'))
          );

          -- Indexes for performance
          CREATE INDEX IF NOT EXISTS idx_test_results_endpoint ON test_results(endpoint);
          CREATE INDEX IF NOT EXISTS idx_test_results_timestamp ON test_results(timestamp DESC);
          CREATE INDEX IF NOT EXISTS idx_test_results_success ON test_results(success);
          CREATE INDEX IF NOT EXISTS idx_endpoint_stats_updated ON endpoint_stats(last_updated DESC);
        `);

        console.log('✅ Monitoring tables created successfully');
      }

      this.sqlEnabled = true;
      console.log('🎉 SQLite operations successful - monitoring enabled');
    } catch (error) {
      console.error('❌ Failed to initialize monitoring database:', error);
      this.sqlEnabled = false;
      this.sql = null;
    }
  }

  /**
   * Restore monitoring state from storage
   */
  private async restoreState(): Promise<void> {
    try {
      const storedConfig = await this.ctx.storage.get<TestConfiguration>('testConfig');
      if (storedConfig) {
        this.testConfig = { ...this.defaultConfig, ...storedConfig };
      }

      this.isTestingActive = (await this.ctx.storage.get<boolean>('isTestingActive')) ?? false;

      console.log('MonitoringDO: 📊 State restored', {
        isTestingActive: this.isTestingActive,
        intervalMs: this.testConfig.intervalMs,
        enabledEndpoints: this.testConfig.enabledEndpoints.length,
      });
    } catch (error) {
      console.error('❌ Failed to restore monitoring state:', error);
    }
  }

  /**
   * Set next alarm for periodic testing
   */
  private async setNextAlarm(): Promise<void> {
    if (this.isTestingActive) {
      await this.ctx.storage.setAlarm(Date.now() + this.testConfig.intervalMs);
      console.log(`⏰ Next test scheduled in ${this.testConfig.intervalMs}ms`);
    }
  }

  /**
   * Alarm handler - runs periodic API tests
   */
  async alarm(): Promise<void> {
    if (!this.isTestingActive) {
      console.log('⏸️ Testing paused - skipping alarm');
      return;
    }

    console.log('🚨 Alarm triggered - starting API test cycle');

    try {
      await this.runTestCycle();
      await this.setNextAlarm(); // Schedule next test
    } catch (error) {
      console.error('❌ Test cycle failed:', error);
      // Still schedule next alarm to keep monitoring running
      await this.setNextAlarm();
    }
  }

  /**
   * Run a complete test cycle for all enabled endpoints
   */
  private async runTestCycle(): Promise<void> {
    const sessionId = `session_${Date.now()}`;
    const startTime = Date.now();

    console.log(`🧪 Starting test session: ${sessionId}`);

    if (!this.sqlEnabled) {
      console.error('❌ SQLite not available - cannot store test results');
      return;
    }

    // Create test session record
    this.sql!.exec(
      `
      INSERT INTO test_sessions (id, config)
      VALUES (?, ?)
    `,
      sessionId,
      JSON.stringify(this.testConfig),
    );

    const results: TestResult[] = [];

    // Test each enabled endpoint
    for (const endpoint of this.testConfig.enabledEndpoints) {
      try {
        console.log(`🔍 Testing endpoint: ${endpoint}`);
        const result = await this.testEndpoint(endpoint);
        results.push(result);
        await this.storeTestResult(result);
        await this.updateEndpointStats(endpoint, result);

        console.log(`${result.success ? '✅' : '❌'} ${endpoint}: ${result.responseTimeMs}ms`);
      } catch (error) {
        console.error(`❌ Failed to test ${endpoint}:`, error);
        const errorResult: TestResult = {
          id: `${endpoint}_${Date.now()}`,
          endpoint,
          testUrl: this.getTestUrlForEndpoint(endpoint),
          success: false,
          responseTimeMs: 0,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        };
        results.push(errorResult);
        await this.storeTestResult(errorResult);
        await this.updateEndpointStats(endpoint, errorResult);
      }
    }

    // Update session summary
    const endTime = Date.now();
    const totalTests = results.length;
    const successfulTests = results.filter((r) => r.success).length;
    const failedTests = totalTests - successfulTests;
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTimeMs, 0) / totalTests;

    this.sql!.exec(
      `
      UPDATE test_sessions 
      SET end_time = datetime('now'),
          total_tests = ?,
          successful_tests = ?,
          failed_tests = ?,
          avg_response_time_ms = ?
      WHERE id = ?
    `,
      totalTests,
      successfulTests,
      failedTests,
      avgResponseTime,
      sessionId,
    );

    console.log(
      `🏁 Test session completed: ${successfulTests}/${totalTests} passed, avg: ${avgResponseTime.toFixed(2)}ms`,
    );
  }

  /**
   * Test a specific API endpoint
   */
  private async testEndpoint(endpoint: string): Promise<TestResult> {
    const startTime = Date.now();
    const testUrl = this.getTestUrlForEndpoint(endpoint);
    const payload = this.getTestPayloadForEndpoint(endpoint);

    try {
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.testConfig.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.testConfig.timeoutMs),
      });

      const endTime = Date.now();
      const responseTimeMs = endTime - startTime;

      let responseSize = 0;
      let creditsCost = 0;

      if (response.ok) {
        const responseData = await response.json();
        responseSize = JSON.stringify(responseData).length;

        // Extract credits cost if available
        if (responseData.credits) {
          creditsCost = responseData.credits;
        }
      }

      return {
        id: `${endpoint}_${startTime}`,
        endpoint,
        testUrl,
        success: response.ok,
        responseTimeMs,
        statusCode: response.status,
        responseSize,
        creditsCost,
        timestamp: new Date().toISOString(),
        testConfig: JSON.stringify(payload),
      };
    } catch (error) {
      const endTime = Date.now();
      const responseTimeMs = endTime - startTime;

      return {
        id: `${endpoint}_${startTime}`,
        endpoint,
        testUrl,
        success: false,
        responseTimeMs,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        testConfig: JSON.stringify(payload),
      };
    }
  }

  /**
   * Get test URL for specific endpoint
   */
  private getTestUrlForEndpoint(endpoint: string): string {
    return `${this.testConfig.apiBaseUrl}/${endpoint}`;
  }

  /**
   * Get test payload for specific endpoint
   */
  private getTestPayloadForEndpoint(endpoint: string): any {
    const basePayload = {
      url: 'https://example.com',
      waitFor: 1000,
    };

    switch (endpoint) {
      case 'screenshot':
        return {
          ...basePayload,
          options: {
            fullPage: false,
            type: 'png',
          },
        };

      case 'markdown':
      case 'content':
        return {
          ...basePayload,
          options: {
            includeLinks: true,
            includeImages: false,
          },
        };

      case 'scrape':
        return {
          ...basePayload,
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Page title' },
            },
          },
        };

      case 'links':
        return {
          ...basePayload,
          options: {
            internal: true,
            external: false,
          },
        };

      case 'search':
        return {
          query: 'test search query',
          options: {
            maxResults: 5,
          },
        };

      case 'pdf':
        return {
          ...basePayload,
          options: {
            format: 'A4',
            printBackground: true,
          },
        };

      default:
        return basePayload;
    }
  }

  /**
   * Store test result in database
   */
  private async storeTestResult(result: TestResult): Promise<void> {
    if (!this.sqlEnabled || !this.sql) {
      return;
    }

    try {
      this.sql.exec(
        `
        INSERT INTO test_results (
          id, endpoint, test_url, success, response_time_ms,
          status_code, error_message, response_size, credits_cost,
          timestamp, test_config
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        result.id,
        result.endpoint,
        result.testUrl,
        result.success,
        result.responseTimeMs,
        result.statusCode || null,
        result.errorMessage || null,
        result.responseSize || null,
        result.creditsCost || null,
        result.timestamp,
        result.testConfig || null,
      );
    } catch (error) {
      console.error('❌ Failed to store test result:', error);
    }
  }

  /**
   * Update endpoint statistics
   */
  private async updateEndpointStats(endpoint: string, result: TestResult): Promise<void> {
    if (!this.sqlEnabled || !this.sql) {
      return;
    }

    try {
      // Get current stats
      const currentStats = this.sql.exec('SELECT * FROM endpoint_stats WHERE endpoint = ?', endpoint).one() as any;

      if (currentStats) {
        // Update existing stats
        const newTotalTests = currentStats.total_tests + 1;
        const newSuccessfulTests = currentStats.successful_tests + (result.success ? 1 : 0);
        const newFailedTests = currentStats.failed_tests + (result.success ? 0 : 1);

        // Calculate new average response time
        const totalResponseTime = currentStats.avg_response_time_ms * currentStats.total_tests + result.responseTimeMs;
        const newAvgResponseTime = totalResponseTime / newTotalTests;

        // Update min/max response times
        const newMinResponseTime = Math.min(currentStats.min_response_time_ms || Infinity, result.responseTimeMs);
        const newMaxResponseTime = Math.max(currentStats.max_response_time_ms || 0, result.responseTimeMs);

        this.sql.exec(
          `
          UPDATE endpoint_stats SET
            total_tests = ?,
            successful_tests = ?,
            failed_tests = ?,
            avg_response_time_ms = ?,
            min_response_time_ms = ?,
            max_response_time_ms = ?,
            last_success_time = CASE WHEN ? THEN ? ELSE last_success_time END,
            last_failure_time = CASE WHEN ? THEN ? ELSE last_failure_time END,
            last_updated = datetime('now')
          WHERE endpoint = ?
        `,
          newTotalTests,
          newSuccessfulTests,
          newFailedTests,
          newAvgResponseTime,
          newMinResponseTime,
          newMaxResponseTime,
          result.success,
          result.success ? result.timestamp : null,
          !result.success,
          !result.success ? result.timestamp : null,
          endpoint,
        );
      } else {
        // Create new stats record
        this.sql.exec(
          `
          INSERT INTO endpoint_stats (
            endpoint, total_tests, successful_tests, failed_tests,
            avg_response_time_ms, min_response_time_ms, max_response_time_ms,
            last_success_time, last_failure_time
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)
        `,
          endpoint,
          result.success ? 1 : 0,
          result.success ? 0 : 1,
          result.responseTimeMs,
          result.responseTimeMs,
          result.responseTimeMs,
          result.success ? result.timestamp : null,
          result.success ? null : result.timestamp,
        );
      }
    } catch (error) {
      console.error('❌ Failed to update endpoint stats:', error);
    }
  }

  /**
   * Start monitoring with optional configuration
   */
  async startMonitoring(config?: Partial<TestConfiguration>): Promise<MonitoringResponse> {
    try {
      if (config) {
        this.testConfig = { ...this.testConfig, ...config };
        await this.ctx.storage.put('testConfig', this.testConfig);
      }

      if (!this.testConfig.apiKey) {
        return {
          success: false,
          error: 'API key is required to start monitoring',
        };
      }

      this.isTestingActive = true;
      await this.ctx.storage.put('isTestingActive', true);
      await this.setNextAlarm();

      console.log('🚀 Monitoring started', {
        interval: this.testConfig.intervalMs,
        endpoints: this.testConfig.enabledEndpoints,
      });

      return {
        success: true,
        data: {
          message: 'Monitoring started successfully',
          config: this.testConfig,
          nextTestIn: this.testConfig.intervalMs,
        },
      };
    } catch (error) {
      console.error('❌ Failed to start monitoring:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<MonitoringResponse> {
    try {
      this.isTestingActive = false;
      await this.ctx.storage.put('isTestingActive', false);
      await this.ctx.storage.deleteAlarm();

      console.log('⏹️ Monitoring stopped');

      return {
        success: true,
        data: {
          message: 'Monitoring stopped successfully',
        },
      };
    } catch (error) {
      console.error('❌ Failed to stop monitoring:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current monitoring status
   */
  async getMonitoringStatus(): Promise<MonitoringResponse> {
    try {
      const nextAlarm = await this.ctx.storage.getAlarm();
      const nextTestIn = nextAlarm ? nextAlarm - Date.now() : null;
      const nextTestAt = nextAlarm ? new Date(nextAlarm).toISOString() : null;

      return {
        success: true,
        data: {
          isActive: this.isTestingActive,
          config: this.testConfig,
          sqlEnabled: this.sqlEnabled,
          nextTestIn,
          nextTestAt,
        },
      };
    } catch (error) {
      console.error('❌ Failed to get monitoring status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get test results with filtering and pagination
   */
  async getTestResults(
    params: {
      endpoint?: string;
      limit?: number;
      offset?: number;
      successOnly?: boolean;
      since?: string;
    } = {},
  ): Promise<MonitoringResponse> {
    if (!this.sqlEnabled || !this.sql) {
      return {
        success: false,
        error: 'SQLite not available',
      };
    }

    try {
      const { endpoint, limit = 100, offset = 0, successOnly, since } = params;

      let query = 'SELECT * FROM test_results WHERE 1=1';
      const queryParams: any[] = [];

      if (endpoint) {
        query += ' AND endpoint = ?';
        queryParams.push(endpoint);
      }

      if (successOnly !== undefined) {
        query += ' AND success = ?';
        queryParams.push(successOnly);
      }

      if (since) {
        query += ' AND timestamp >= ?';
        queryParams.push(since);
      }

      // Get total count
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
      const totalCount = this.sql.exec(countQuery, ...queryParams).one() as any;

      // Add ordering and pagination
      query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
      queryParams.push(limit, offset);

      const results = [...this.sql.exec(query, ...queryParams)];

      return {
        success: true,
        data: {
          results: results.map((row: any) => ({
            id: row.id,
            endpoint: row.endpoint,
            testUrl: row.test_url,
            success: Boolean(row.success),
            responseTimeMs: row.response_time_ms,
            statusCode: row.status_code,
            errorMessage: row.error_message,
            responseSize: row.response_size,
            creditsCost: row.credits_cost,
            timestamp: row.timestamp,
          })),
          totalCount: totalCount.count,
          limit,
          offset,
          hasMore: totalCount.count > offset + limit,
        },
      };
    } catch (error) {
      console.error('❌ Failed to get test results:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get endpoint performance statistics
   */
  async getEndpointStats(): Promise<MonitoringResponse> {
    if (!this.sqlEnabled || !this.sql) {
      return {
        success: false,
        error: 'SQLite not available',
      };
    }

    try {
      const stats = [...this.sql.exec('SELECT * FROM endpoint_stats ORDER BY last_updated DESC')];

      const endpointStats = stats.map((row: any) => ({
        endpoint: row.endpoint,
        totalTests: row.total_tests,
        successfulTests: row.successful_tests,
        failedTests: row.failed_tests,
        successRate: ((row.successful_tests / row.total_tests) * 100).toFixed(2) + '%',
        avgResponseTimeMs: Math.round(row.avg_response_time_ms || 0),
        minResponseTimeMs: row.min_response_time_ms || 0,
        maxResponseTimeMs: row.max_response_time_ms || 0,
        lastSuccessTime: row.last_success_time,
        lastFailureTime: row.last_failure_time,
        lastUpdated: row.last_updated,
      }));

      return {
        success: true,
        data: {
          endpointStats,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('❌ Failed to get endpoint stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Run manual test cycle (for immediate testing)
   */
  async runManualTest(): Promise<MonitoringResponse> {
    try {
      if (!this.testConfig.apiKey) {
        return {
          success: false,
          error: 'API key is required to run tests',
        };
      }

      console.log('🧪 Running manual test cycle...');
      await this.runTestCycle();

      return {
        success: true,
        data: {
          message: 'Manual test cycle completed successfully',
        },
      };
    } catch (error) {
      console.error('❌ Manual test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle HTTP requests to the durable object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/start': {
          const { config } = await request.json();
          const result = await this.startMonitoring(config);
          return Response.json(result, { status: result.success ? 200 : 400 });
        }

        case '/stop': {
          const result = await this.stopMonitoring();
          return Response.json(result, { status: result.success ? 200 : 500 });
        }

        case '/status': {
          const result = await this.getMonitoringStatus();
          return Response.json(result, { status: result.success ? 200 : 500 });
        }

        case '/results': {
          const params = await request.json();
          const result = await this.getTestResults(params);
          return Response.json(result, { status: result.success ? 200 : 500 });
        }

        case '/stats': {
          const result = await this.getEndpointStats();
          return Response.json(result, { status: result.success ? 200 : 500 });
        }

        case '/test': {
          const result = await this.runManualTest();
          return Response.json(result, { status: result.success ? 200 : 500 });
        }

        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('❌ Monitoring DO request failed:', error);
      return Response.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }
  }
}

interface TestConfiguration {
  intervalMs: number;
  apiBaseUrl: string;
  apiKey: string;
  timeoutMs: number;
  enabledEndpoints: string[];
}

interface TestResult {
  id: string;
  endpoint: string;
  testUrl: string;
  success: boolean;
  responseTimeMs: number;
  statusCode?: number;
  errorMessage?: string;
  responseSize?: number;
  creditsCost?: number;
  timestamp: string;
  testConfig?: string;
}

interface MonitoringResponse {
  success: boolean;
  data?: any;
  error?: string;
}
