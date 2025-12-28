import { Registry } from "prom-client";

export { Counter, Histogram } from "prom-client";

/**
 * Shared Prometheus registry for all services.
 *
 * Metric Naming Conventions:
 * - AI Service: openai_*, prompt_injection_*
 * - Tasks Service: tasks_*
 *
 * Important: Use unique prefixes per service to avoid metric name collisions.
 * All services register metrics to this shared registry, which is exposed via
 * the /metrics endpoint in each service.
 */
export const register = new Registry();
