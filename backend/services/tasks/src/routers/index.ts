import { Router } from "express";

import { tokenBucketRateLimiter } from "@middlewares/token-bucket-rate-limiter";
import { healthRouter } from "@routers/health-router";
import { tasksRouter } from "@routers/tasks-router";
import { HEALTH_ROUTE, METRICS_ROUTE } from "@shared/constants";
import { authentication } from "@shared/middlewares/authentication";
import { requestId } from "@shared/middlewares/request-id";
import { requestResponseMetadata } from "@shared/middlewares/request-response-metadata";
import { metricsRouter } from "@shared/routers";

export const routers = Router();

routers.use(METRICS_ROUTE, metricsRouter);

routers.use(HEALTH_ROUTE, [requestId, requestResponseMetadata], healthRouter);

routers.use(
  "/api/v1/tasks",
  [
    requestId,
    authentication,
    requestResponseMetadata,
    tokenBucketRateLimiter.api,
  ],
  tasksRouter
);
