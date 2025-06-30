import { createRouter } from './lib/create-app';
import * as monitoringHandlers from './routes/monitoring.handlers';
import * as monitoringRoutes from './routes/monitoring.routes';

const app = createRouter()
  .get('/', (c) => {
    return c.text('WebLinq API Monitoring System 🔍');
  })
  .openapi(monitoringRoutes.startMonitoring, monitoringHandlers.startMonitoring)
  .openapi(monitoringRoutes.stopMonitoring, monitoringHandlers.stopMonitoring)
  .openapi(monitoringRoutes.getMonitoringStatus, monitoringHandlers.getMonitoringStatus)
  .openapi(monitoringRoutes.getTestResults, monitoringHandlers.getTestResults)
  .openapi(monitoringRoutes.getEndpointStats, monitoringHandlers.getEndpointStats)
  .openapi(monitoringRoutes.runManualTest, monitoringHandlers.runManualTest);

export default app;

// Export the MonitoringDO class for Cloudflare Workers
export { MonitoringDO } from './durable-objects/monitoring-do';
