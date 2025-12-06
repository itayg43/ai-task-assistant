import { env } from "@config/env";
import { initializeServer } from "@shared/utils/server";
import { app } from "./app";

(async () => await initializeServer(env.SERVICE_NAME, env.SERVICE_PORT, app))();
