import express, { Request, Response } from "express";
import { StatusCodes, ReasonPhrases } from "http-status-codes";
import helmet from "helmet";

const app = express();

app.use(helmet());
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.get("/health", (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    message: ReasonPhrases.OK,
  });
});

export default app;
