import { closeRabbitMQClient, connectRabbitMQClient } from "@clients/rabbitmq";
import { env } from "@config/env";
import { consumeCapabilitiesMessage } from "@consumers/capabilities-consumer";
import { initializeConsumer } from "@shared/utils/consumer";

(async () => {
  await initializeConsumer(`${env.SERVICE_NAME} - consumer`, {
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
