import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import z from "zod";

import { createTaskInputSchema } from "@schemas/webhooks-schemas";
import { createLogger } from "@shared/config/create-logger";

const logger = createLogger("webhooksController");

export const createTask = (
  req: Request<unknown, unknown, z.infer<typeof createTaskInputSchema>["body"]>,
  res: Response,
  _next: NextFunction
) => {
  const { aiServiceRequestId, success } = req.body;

  try {
    if (!success) {
      const { status, message, context } = req.body.error;

      console.log("STATUS:", status);
      console.log("MESSAGE:", message);
      console.log("CONTEXT:", JSON.stringify(context, null, 2));

      // TODO:
      // sanitize error
      // handle tokens
    }
  } catch (error) {
    logger.error("Failed to create task", error, {
      aiServiceRequestId,
    });
  } finally {
    res.sendStatus(StatusCodes.OK);
  }
};

// const tokensUsed = extractOpenaiTokenUsage(openaiMetadata);

//   const task = await prisma.$transaction(async (tx) => {
//     const createdTask = await createTask(
//       tx,
//       userId,
//       naturalLanguage,
//       parsedTask
//     );

//     if (parsedTask.subtasks && parsedTask.subtasks.length > 0) {
//       await createManySubtasks(tx, createdTask.id, userId, parsedTask.subtasks);
//     }

//     const taskWithSubtasks = await findTaskById(tx, createdTask.id, userId);

//     return taskWithSubtasks!;
//   });

//   return {
//     task,
//     tokensUsed,
//   };
