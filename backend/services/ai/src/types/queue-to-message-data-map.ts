import { RABBITMQ_QUEUE } from "@constants";
import { CapabilitiesQueueMessageData } from "@types";

export type QueueToMessageDataMap = {
  [RABBITMQ_QUEUE.CAPABILITIES]: CapabilitiesQueueMessageData;
};
