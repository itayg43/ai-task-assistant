import { createCors } from "@shared/middlewares/cors/create-cors";

export const cors = createCors(["http://localhost:3000", "http://ai:3000"]);
