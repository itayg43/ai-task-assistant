import { Registry } from "prom-client";

export { Counter, Histogram } from "prom-client";

export const register = new Registry();
