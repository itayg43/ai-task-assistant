import { RABBITMQ_QUEUE } from "@constants";
import { publishJob } from "@clients/rabbitmq";
import { createLogger } from "@shared/config/create-logger";
import { BadRequestError, InternalError } from "@shared/errors";
import { withDurationAsync } from "@shared/utils/with-duration";
import { TCapabilityJobPayload } from "@types";
import { CapabilityConfig } from "@types";

const logger = createLogger("executeAsyncPattern");

/**
 * Executes the async pattern by publishing a job to RabbitMQ.
 *
 * Flow:
 * 1. Extract async-specific fields (callbackUrl, userId, tokenReservation) from input query
 * 2. Validate required fields are present (throw BadRequestError if missing)
 * 3. Create job payload with capability name, full input, and async metadata
 * 4. Publish job to RabbitMQ queue
 * 5. Return minimal result (job queued, duration is queue time only)
 *
 * Note: We store the capability name (from input.params.capability) instead of the full
 * CapabilityConfig because CapabilityConfig contains functions (handler) and Zod schemas
 * that cannot be serialized to JSON. The worker will look up the config from the
 * capabilities registry using this name.
 *
 * IMPORTANT: tokenReservation Nested Object in Query Parameters
 * ============================================================
 * HTTP query strings are flat key-value pairs (e.g., ?key=value&key2=value2).
 * However, our schema expects tokenReservation as a nested object:
 *   { tokensReserved: number, windowStartTimestamp: number }
 *
 * This requires special handling. Options:
 *
 * 1. JSON-encoded string (RECOMMENDED for MVP):
 *    - Client sends: ?tokenReservation={"tokensReserved":1000,"windowStartTimestamp":1234567890}
 *    - Express parses it as a string
 *    - Zod schema needs preprocessor to parse JSON string to object
 *    - Pros: Simple, works with existing schema structure
 *    - Cons: URL encoding needed, less readable
 *
 * 2. Flattened keys:
 *    - Client sends: ?tokenReservation.tokensReserved=1000&tokenReservation.windowStartTimestamp=1234567890
 *    - Express parses as flat object: { "tokenReservation.tokensReserved": "1000", ... }
 *    - Zod schema needs preprocessor to reconstruct nested object
 *    - Pros: More readable, standard query string format
 *    - Cons: Requires custom parsing logic
 *
 * 3. Separate query parameters:
 *    - Change schema to: tokensReserved, windowStartTimestamp (flat)
 *    - Client sends: ?tokensReserved=1000&windowStartTimestamp=1234567890
 *    - Pros: Simplest, standard HTTP query format
 *    - Cons: Loses semantic grouping, requires schema change
 *
 * Current Implementation:
 * - Schema expects nested object (option 1 or 2)
 * - If using option 1 (JSON string), add preprocessor to schema:
 *   z.preprocess((val) => typeof val === 'string' ? JSON.parse(val) : val, z.object({...}))
 * - If using option 2 (flattened), add preprocessor to reconstruct object
 * - For now, assuming the validation middleware handles the parsing
 */
export const executeAsyncPattern = async <TInput, TOutput>(
  config: CapabilityConfig<TInput, TOutput>,
  input: TInput,
  requestId: string
) => {
  return await withDurationAsync(async () => {
    const baseLogContext = {
      requestId,
      capability: config.name,
    };

    logger.info("executeAsyncPattern - starting", baseLogContext);

    // Extract async-specific fields from input query
    // The discriminated union ensures that when pattern is "async", these fields exist
    // TypeScript doesn't know the exact shape, so we need to check at runtime
    const inputQuery = (input as any).query;
    if (!inputQuery) {
      throw new InternalError("Missing query in input");
    }

    // Type guard: Check if pattern is async (discriminated union ensures fields exist)
    if (inputQuery.pattern !== "async") {
      throw new InternalError(
        "executeAsyncPattern called but pattern is not async"
      );
    }

    // Extract async fields from query (discriminated union guarantees these exist when pattern is async)
    const { callbackUrl, userId, tokenReservation } = inputQuery;

    // Validate required fields are present (should not happen if schema validation passed, but defensive check)
    if (!callbackUrl) {
      throw new BadRequestError("Missing required field: callbackUrl");
    }
    if (userId === undefined || userId === null) {
      throw new BadRequestError("Missing required field: userId");
    }
    if (!tokenReservation) {
      throw new BadRequestError("Missing required field: tokenReservation");
    }

    // Extract capability name from input params
    const capability = (input as any).params?.capability;
    if (!capability) {
      throw new InternalError("Missing capability in input params");
    }

    // Create job payload
    // Note: We store the capability name (string) instead of the full CapabilityConfig
    // because CapabilityConfig contains functions and schemas that cannot be serialized.
    // The worker will look up the config from the capabilities registry using this name.
    const jobPayload: TCapabilityJobPayload<any> = {
      capability,
      input, // Full validated input (params, query, body) - matches what executeSyncPattern expects
      callbackUrl,
      requestId,
      userId,
      tokenReservation: {
        tokensReserved: tokenReservation.tokensReserved,
        windowStartTimestamp: tokenReservation.windowStartTimestamp,
      },
    };

    logger.info("executeAsyncPattern - publishing job", {
      ...baseLogContext,
      queueName: RABBITMQ_QUEUE.AI_CAPABILITY_JOBS,
    });

    try {
      // Publish job to RabbitMQ
      await publishJob(RABBITMQ_QUEUE.AI_CAPABILITY_JOBS, jobPayload);

      logger.info("executeAsyncPattern - job published successfully", {
        ...baseLogContext,
        queueName: RABBITMQ_QUEUE.AI_CAPABILITY_JOBS,
      });

      // Return minimal result (job queued, duration is queue time only)
      // Note: For async pattern, the result is not used by the controller (it returns 202 with aiServiceRequestId)
      // We cast to TOutput to satisfy the type signature, but the actual result is not meaningful
      return {} as TOutput;
    } catch (error) {
      logger.error("executeAsyncPattern - failed to publish job", error, {
        ...baseLogContext,
        queueName: RABBITMQ_QUEUE.AI_CAPABILITY_JOBS,
      });

      throw new InternalError("Failed to queue job for processing");
    }
  });
};
