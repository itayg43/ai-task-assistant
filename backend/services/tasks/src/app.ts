import express from "express";
import helmet from "helmet";

import { healthRouter } from "@modules/health/health-router";
import { apiV1Router } from "@routers/api";
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
app.use("/api/v1", [authentication, requestResponseMetadata], apiV1Router);
app.use(errorHandler);
