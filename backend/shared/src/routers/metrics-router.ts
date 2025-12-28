import { Request, Response, Router } from "express";
import { StatusCodes } from "http-status-codes";

import { register } from "../clients/prom";
import { createLogger } from "../config/create-logger";
import { DEFAULT_ERROR_MESSAGE } from "../constants";

const logger = createLogger("metricsRouter");

export const metricsRouter = Router();

metricsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error("Unexpected error in: GET /metrics", error);

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(DEFAULT_ERROR_MESSAGE);
  }
});
