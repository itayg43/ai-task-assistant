import "dotenv/config";
import { cleanEnv, port } from "envalid";

const env = cleanEnv(process.env, {
  PORT: port(),
});

export default env;
