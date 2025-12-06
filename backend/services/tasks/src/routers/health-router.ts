import { NextFunction, Request, Response, Router } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "@clients/prisma";
import { redis } from "@clients/redis";

export const healthRouter = Router();

healthRouter.get("/healthz", (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    status: "ok",
  });
});

healthRouter.get(
  "/readyz",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await Promise.all([redis.ping(), prisma.$queryRaw`SELECT 1`]);

      res.status(StatusCodes.OK).json({
        status: "ok",
        redis: "ok",
        database: "ok",
      });
    } catch (error) {
      next(error);
    }
  }
);
