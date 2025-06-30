import type { AppRouteHandler } from '../lib/types';

import type {
  GetEndpointStatsRoute,
  GetMonitoringStatusRoute,
  GetTestResultsRoute,
  RunManualTestRoute,
  StartMonitoringRoute,
  StopMonitoringRoute,
} from './monitoring.routes';

/**
 * Get monitoring durable object instance
 */
function getMonitoringDO(env: CloudflareBindings) {
  const id = env.MONITORING_DO.idFromName('global');
  return env.MONITORING_DO.get(id);
}

/**
 * Start monitoring with optional configuration
 */
export const startMonitoring: AppRouteHandler<StartMonitoringRoute> = async (c) => {
  try {
    const { config = {} } = await c.req.json();

    // Set API key from environment if not provided
    if (!config.apiKey) {
      // Extract API key from Authorization header if available
      const authHeader = c.req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        config.apiKey = authHeader.substring(7);
      } else {
        return c.json(
          {
            success: false,
            error: 'API key required. Provide in config.apiKey or Authorization header.',
          },
          400,
        );
      }
    }

    const monitoringDO = getMonitoringDO(c.env);
    const response = await monitoringDO.fetch('http://monitoring/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });

    const result = await response.json();
    return c.json(result, response.status);
  } catch (error) {
    console.error('Start monitoring error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
};

/**
 * Stop monitoring
 */
export const stopMonitoring: AppRouteHandler<StopMonitoringRoute> = async (c) => {
  try {
    const monitoringDO = getMonitoringDO(c.env);
    const response = await monitoringDO.fetch('http://monitoring/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = await response.json();
    return c.json(result, response.status);
  } catch (error) {
    console.error('Stop monitoring error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
};

/**
 * Get monitoring status
 */
export const getMonitoringStatus: AppRouteHandler<GetMonitoringStatusRoute> = async (c) => {
  try {
    const monitoringDO = getMonitoringDO(c.env);
    const response = await monitoringDO.fetch('http://monitoring/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = await response.json();
    return c.json(result, response.status);
  } catch (error) {
    console.error('Get monitoring status error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
};

/**
 * Get test results with filtering and pagination
 */
export const getTestResults: AppRouteHandler<GetTestResultsRoute> = async (c) => {
  try {
    const params = await c.req.json();

    const monitoringDO = getMonitoringDO(c.env);
    const response = await monitoringDO.fetch('http://monitoring/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const result = await response.json();
    return c.json(result, response.status);
  } catch (error) {
    console.error('Get test results error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
};

/**
 * Get endpoint statistics
 */
export const getEndpointStats: AppRouteHandler<GetEndpointStatsRoute> = async (c) => {
  try {
    const monitoringDO = getMonitoringDO(c.env);
    const response = await monitoringDO.fetch('http://monitoring/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = await response.json();
    return c.json(result, response.status);
  } catch (error) {
    console.error('Get endpoint stats error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
};

/**
 * Run manual test cycle
 */
export const runManualTest: AppRouteHandler<RunManualTestRoute> = async (c) => {
  try {
    const monitoringDO = getMonitoringDO(c.env);
    const response = await monitoringDO.fetch('http://monitoring/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = await response.json();
    return c.json(result, response.status);
  } catch (error) {
    console.error('Run manual test error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
};
