import { Request, Response, Router } from "express";
import { StatusCodes } from "http-status-codes";

export const healthRouter = Router();

healthRouter.get("/healthz", (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    status: "ok",
  });
});
