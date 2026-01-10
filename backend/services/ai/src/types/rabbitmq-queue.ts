import { RABBITMQ_QUEUE } from "@constants";

export type RabbitMQQueue =
  (typeof RABBITMQ_QUEUE)[keyof typeof RABBITMQ_QUEUE];
