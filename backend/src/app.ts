import express, { Request, Response } from "express";
import helmet from "helmet";
import { StatusCodes } from "http-status-codes";

export const app = express();

app.use(helmet());
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.sendStatus(StatusCodes.OK);
});
