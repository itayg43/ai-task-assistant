import express, { Request, Response } from "express";
import helmet from "helmet";
import { StatusCodes } from "http-status-codes";

import { errorHandler } from "@middlewares/error-handler";
import { requestResponseMetadata } from "@middlewares/request-response-metadata";

export const app = express();

app.use(helmet());
app.use(requestResponseMetadata);
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.sendStatus(StatusCodes.OK);
});

app.use(errorHandler);
