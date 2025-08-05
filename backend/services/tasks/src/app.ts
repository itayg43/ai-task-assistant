import express from "express";
import helmet from "helmet";

import { tokenBucketRateLimiter } from "@middlewares/token-bucket-rate-limiter";
import { healthRouter } from "@routers/health-router";
import { tasksRouter } from "@routers/tasks-router";
import { authentication } from "@shared/middlewares/authentication";
import { errorHandler } from "@shared/middlewares/error-handler";
import { requestResponseMetadata } from "@shared/middlewares/request-response-metadata";

export const app = express();

app.use(helmet());
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use("/health", [requestResponseMetadata], healthRouter);
app.use(
  "/api/v1/tasks",
  [authentication, requestResponseMetadata, tokenBucketRateLimiter.global],
  tasksRouter
);
app.use(errorHandler);
