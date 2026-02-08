import { Router } from "express";

import { tokenBucketRateLimiter } from "@middlewares/token-bucket-rate-limiter";
import { tasksRouter } from "@routers/tasks-router";
import { webhooksRouter } from "@routers/webhooks-router";
import { METRICS_ROUTE } from "@shared/constants";
import { authentication } from "@shared/middlewares/authentication";
import { requestId } from "@shared/middlewares/request-id";
import { requestResponseMetadata } from "@shared/middlewares/request-response-metadata";
import { metricsRouter } from "@shared/routers";

export const routers = Router();

routers.use(METRICS_ROUTE, metricsRouter);

routers.use(
  "/api/v1/tasks",
  [
    requestId,
    authentication,
    requestResponseMetadata,
    tokenBucketRateLimiter.api,
  ],
  tasksRouter,
);

routers.use(
  "/api/v1/webhooks",
  [authentication, requestResponseMetadata],
  webhooksRouter,
);
