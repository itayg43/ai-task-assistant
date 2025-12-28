import express from "express";
import helmet from "helmet";

import { env } from "@config/env";
import { routers } from "@routers";
import { createErrorHandler } from "@shared/middlewares/error-handler";

export const app = express();

app.use(helmet());
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use("/", routers);
app.use(createErrorHandler(env.SERVICE_NAME));
