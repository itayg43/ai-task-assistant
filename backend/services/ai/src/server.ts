import { closeRabbitMQClient, connectRabbitMQClient } from "@clients/rabbitmq";
import { env } from "@config/env";
import { initializeServer } from "@shared/utils/server";
import { consumeCapabilitiesMessage } from "@workers/capabilities-worker";
import { app } from "./app";

(async () => {
  await initializeServer(env.SERVICE_NAME, env.SERVICE_PORT, app, {
    startCallback: async () => {
      await connectRabbitMQClient();
      await consumeCapabilitiesMessage();
    },
    cleanupCallbacks: {
      afterSuccess: async () => {
        await closeRabbitMQClient();
      },
      afterFailure: async () => {
        await closeRabbitMQClient();
      },
    },
  });
})();
