FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001
EXPOSE 51204

CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "src/server.ts"]
