import express from "express";
import helmet from "helmet";

import { env } from "@config/env";
import { cors } from "@middlewares/cors";
import { capabilitiesRouter } from "@routers/capabilities-router";
import { healthRouter } from "@routers/health-router";
import { HEALTH_ROUTE } from "@shared/constants";
import { authentication } from "@shared/middlewares/authentication";
import { createErrorHandler } from "@shared/middlewares/error-handler";
import { requestId } from "@shared/middlewares/request-id";
import { requestResponseMetadata } from "@shared/middlewares/request-response-metadata";

export const app = express();

app.use(helmet());
app.use(cors);
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(HEALTH_ROUTE, [requestId, requestResponseMetadata], healthRouter);
app.use(
  "/api/v1/ai/capabilities",
  [requestId, authentication, requestResponseMetadata],
  capabilitiesRouter
);
app.use(createErrorHandler(env.SERVICE_NAME));
