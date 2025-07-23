import { Request, Response, Router } from "express";
import { StatusCodes } from "http-status-codes";

import { redis } from "@clients/redis";

export const healthRouter = Router();

healthRouter.get("/healthz", (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    status: "ok",
  });
});

healthRouter.get("/readyz", async (_req: Request, res: Response) => {
  try {
    await redis.ping();

    res.status(StatusCodes.OK).json({
      status: "ok",
      redis: "ok",
    });
  } catch (error) {
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      status: "error",
      redis: "unreachable",
    });
  }
});
