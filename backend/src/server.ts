import http from "http";

import app from "./app";
import env from "./config/env";

const server = http.createServer(app);

server.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT}`);
});
