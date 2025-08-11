import { createCors } from "@shared/middlewares/cors/create-cors";

export const cors = createCors(["http://localhost:3001", "http://tasks:3001"]);
