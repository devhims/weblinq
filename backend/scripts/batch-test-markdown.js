#!/usr/bin/env node

/**
 * Batch Markdown Extraction Performance Test Script
 *
 * Runs multiple markdown extraction tests to gather performance statistics
 * and identify patterns in performance bottlenecks.
 *
 * Usage: node batch-test-markdown.js [API_KEY] [NUM_TESTS]
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';

// Configuration
const API_KEY = process.argv[2] || process.env.WEBLINQ_API_KEY;
const NUM_TESTS = Number.parseInt(process.argv[3]) || 5;
const DELAY_BETWEEN_TESTS = 2000; // 2 seconds

if (!API_KEY) {
  console.error('❌ Error: API key is required');
  console.error('Usage: node batch-test-markdown.js [API_KEY] [NUM_TESTS]');
  console.error('Or set WEBLINQ_API_KEY environment variable');
  process.exit(1);
}

/**
 * Run a single test
 */
function runSingleTest(testNumber) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Running test ${testNumber}/${NUM_TESTS}...`);

    const testProcess = spawn('node', ['backend/test-markdown-timing.js', API_KEY], {
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    testProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    testProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, success: true });
      } else {
        reject(new Error(`Test ${testNumber} failed with code ${code}: ${stderr}`));
      }
    });

    testProcess.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Parse timing data from test output
 */
function parseTimingData(stdout) {
  const timingData = {
    networkTime: null,
    serverTime: null,
    success: false,
    wordCount: null,
    markdownLength: null,
    timings: {},
  };

  // Extract network timing
  const networkMatch = stdout.match(/Total network time: (\d+)ms/);
  if (networkMatch) {
    timingData.networkTime = Number.parseInt(networkMatch[1]);
  }

  // Extract server timing
  const serverMatch = stdout.match(/Total Duration: (\d+)ms/);
  if (serverMatch) {
    timingData.serverTime = Number.parseInt(serverMatch[1]);
  }

  // Extract success status
  timingData.success = stdout.includes('Success: ✅');

  // Extract word count
  const wordCountMatch = stdout.match(/Word Count: (\d+)/);
  if (wordCountMatch) {
    timingData.wordCount = Number.parseInt(wordCountMatch[1]);
  }

  // Extract markdown length
  const markdownLengthMatch = stdout.match(/Markdown Length: (\d+) characters/);
  if (markdownLengthMatch) {
    timingData.markdownLength = Number.parseInt(markdownLengthMatch[1]);
  }

  // Extract detailed timings
  const timingMatches = [
    { key: 'browserSetup', pattern: /Browser Setup: (\d+)ms/ },
    { key: 'pageNavigation', pattern: /Page Navigation: (\d+)ms/ },
    { key: 'contentExtraction', pattern: /Content Extraction: (\d+)ms/ },
    { key: 'htmlSanitization', pattern: /HTML Sanitization: (\d+)ms/ },
    { key: 'markdownConversion', pattern: /Markdown Conversion: (\d+)ms/ },
    { key: 'responseAssembly', pattern: /Response Assembly: (\d+)ms/ },
  ];

  timingMatches.forEach(({ key, pattern }) => {
    const match = stdout.match(pattern);
    if (match) {
      timingData.timings[key] = Number.parseInt(match[1]);
    }
  });

  return timingData;
}

/**
 * Calculate statistics from test results
 */
function calculateStatistics(results) {
  const successfulResults = results.filter((r) => r.success);
  const failedResults = results.filter((r) => !r.success);

  if (successfulResults.length === 0) {
    return {
      successRate: 0,
      failureRate: 100,
      averages: {},
      medians: {},
      min: {},
      max: {},
      bottlenecks: [],
    };
  }

  const metrics = ['networkTime', 'serverTime', 'wordCount', 'markdownLength'];
  const timingMetrics = [
    'browserSetup',
    'pageNavigation',
    'contentExtraction',
    'htmlSanitization',
    'markdownConversion',
    'responseAssembly',
  ];

  const stats = {
    successRate: (successfulResults.length / results.length) * 100,
    failureRate: (failedResults.length / results.length) * 100,
    averages: {},
    medians: {},
    min: {},
    max: {},
    bottlenecks: [],
  };

  // Calculate statistics for main metrics
  metrics.forEach((metric) => {
    const values = successfulResults.map((r) => r[metric]).filter((v) => v !== null);
    if (values.length > 0) {
      values.sort((a, b) => a - b);
      stats.averages[metric] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      stats.medians[metric] = values[Math.floor(values.length / 2)];
      stats.min[metric] = Math.min(...values);
      stats.max[metric] = Math.max(...values);
    }
  });

  // Calculate statistics for timing metrics
  timingMetrics.forEach((metric) => {
    const values = successfulResults.map((r) => r.timings[metric]).filter((v) => v !== null && v !== undefined);
    if (values.length > 0) {
      values.sort((a, b) => a - b);
      stats.averages[metric] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      stats.medians[metric] = values[Math.floor(values.length / 2)];
      stats.min[metric] = Math.min(...values);
      stats.max[metric] = Math.max(...values);
    }
  });

  // Identify bottlenecks
  if (stats.averages.serverTime) {
    const bottleneckData = timingMetrics
      .map((metric) => ({
        name: metric,
        averageTime: stats.averages[metric] || 0,
        percentage: ((stats.averages[metric] || 0) / stats.averages.serverTime) * 100,
      }))
      .sort((a, b) => b.averageTime - a.averageTime);

    stats.bottlenecks = bottleneckData.slice(0, 3);
  }

  return stats;
}

/**
 * Main batch test function
 */
async function runBatchTests() {
  console.log('🔄 Starting Batch Markdown Extraction Performance Tests');
  console.log(`📊 Running ${NUM_TESTS} tests with ${DELAY_BETWEEN_TESTS}ms delay between tests`);
  console.log(`🔗 API Endpoint: https://api.weblinq.dev/v1/web/markdown`);
  console.log(`⏰ Batch started at: ${new Date().toISOString()}`);
  console.log('─'.repeat(80));

  const batchStart = Date.now();
  const results = [];

  for (let i = 1; i <= NUM_TESTS; i++) {
    try {
      const testResult = await runSingleTest(i);
      const timingData = parseTimingData(testResult.stdout);
      results.push(timingData);

      console.log(
        `✅ Test ${i} completed - ${timingData.success ? 'SUCCESS' : 'FAILED'} (${timingData.serverTime || 'N/A'}ms)`,
      );

      // Delay between tests (except after the last test)
      if (i < NUM_TESTS) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_TESTS));
      }
    } catch (error) {
      console.error(`❌ Test ${i} failed: ${error.message}`);
      results.push({ success: false, error: error.message });
    }
  }

  const batchEnd = Date.now();
  const batchDuration = batchEnd - batchStart;

  console.log('─'.repeat(80));
  console.log('📈 BATCH TEST RESULTS');
  console.log('─'.repeat(80));

  // Calculate statistics
  const stats = calculateStatistics(results);

  console.log(
    `🎯 Success Rate: ${stats.successRate.toFixed(1)}% (${results.filter((r) => r.success).length}/${NUM_TESTS})`,
  );
  console.log(
    `❌ Failure Rate: ${stats.failureRate.toFixed(1)}% (${results.filter((r) => !r.success).length}/${NUM_TESTS})`,
  );
  console.log('');

  if (stats.successRate > 0) {
    console.log('⏱️  Performance Statistics:');
    console.log(
      `  Network Time: ${stats.averages.networkTime}ms (avg) | ${stats.medians.networkTime}ms (median) | ${stats.min.networkTime}-${stats.max.networkTime}ms (range)`,
    );
    console.log(
      `  Server Time:  ${stats.averages.serverTime}ms (avg) | ${stats.medians.serverTime}ms (median) | ${stats.min.serverTime}-${stats.max.serverTime}ms (range)`,
    );
    console.log('');

    console.log('📊 Content Statistics:');
    console.log(
      `  Word Count:     ${stats.averages.wordCount} (avg) | ${stats.medians.wordCount} (median) | ${stats.min.wordCount}-${stats.max.wordCount} (range)`,
    );
    console.log(
      `  Markdown Length: ${stats.averages.markdownLength} chars (avg) | ${stats.medians.markdownLength} chars (median) | ${stats.min.markdownLength}-${stats.max.markdownLength} chars (range)`,
    );
    console.log('');

    console.log('🔍 Performance Bottlenecks (Average):');
    stats.bottlenecks.forEach((bottleneck, index) => {
      console.log(
        `  ${index + 1}. ${bottleneck.name}: ${bottleneck.averageTime}ms (${bottleneck.percentage.toFixed(1)}%)`,
      );
    });
    console.log('');

    console.log('📋 Detailed Timing Breakdown (Average):');
    console.log(`  - Browser Setup: ${stats.averages.browserSetup || 0}ms`);
    console.log(`  - Page Navigation: ${stats.averages.pageNavigation || 0}ms`);
    console.log(`  - Content Extraction: ${stats.averages.contentExtraction || 0}ms`);
    console.log(`  - HTML Sanitization: ${stats.averages.htmlSanitization || 0}ms`);
    console.log(`  - Markdown Conversion: ${stats.averages.markdownConversion || 0}ms`);
    console.log(`  - Response Assembly: ${stats.averages.responseAssembly || 0}ms`);
  }

  console.log('');
  console.log(`🏁 Batch completed in ${batchDuration}ms`);
  console.log(`⏰ Batch ended at: ${new Date().toISOString()}`);

  // Save batch results
  const batchResults = {
    timestamp: new Date().toISOString(),
    numTests: NUM_TESTS,
    batchDuration,
    statistics: stats,
    individualResults: results,
  };

  const filename = `batch-test-results-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(batchResults, null, 2));
  console.log(`📄 Detailed batch results saved to: ${filename}`);

  // Performance assessment
  console.log('');
  console.log('🎯 Performance Assessment:');

  if (stats.successRate < 80) {
    console.log('  ❌ CRITICAL: Success rate below 80%');
  } else if (stats.successRate < 95) {
    console.log('  ⚠️  WARNING: Success rate below 95%');
  } else {
    console.log('  ✅ GOOD: Success rate above 95%');
  }

  if (stats.averages.serverTime > 15000) {
    console.log('  ❌ SLOW: Average server time > 15 seconds');
  } else if (stats.averages.serverTime > 10000) {
    console.log('  ⚠️  MODERATE: Average server time > 10 seconds');
  } else if (stats.averages.serverTime > 5000) {
    console.log('  ✅ ACCEPTABLE: Average server time > 5 seconds');
  } else {
    console.log('  🚀 FAST: Average server time < 5 seconds');
  }

  console.log('─'.repeat(80));
}

// Run the batch tests
runBatchTests().catch(console.error);
