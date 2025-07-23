import express from "express";
import helmet from "helmet";

import { authentication } from "@middlewares/authentication";
import { errorHandler } from "@middlewares/error-handler";
import { requestResponseMetadata } from "@middlewares/request-response-metadata";
import { healthRouter } from "@modules/health/health-router";

export const app = express();

app.use(helmet());
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use("/health", [requestResponseMetadata], healthRouter);
app.use("/api/v1", [authentication, requestResponseMetadata]);
app.use(errorHandler);
