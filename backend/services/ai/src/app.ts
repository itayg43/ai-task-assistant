import express from "express";
import helmet from "helmet";

import { env } from "@config/env";
import { cors } from "@middlewares/cors";
import { routers } from "@routers";
import { createErrorHandler } from "@shared/middlewares/error-handler";

export const app = express();

app.use(helmet());
app.use(cors);
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use("/", routers);
app.use(createErrorHandler(env.SERVICE_NAME));
