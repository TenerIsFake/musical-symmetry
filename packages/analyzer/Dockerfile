FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package.json ./
COPY packages/core/package.json packages/core/
COPY packages/analyzer/package.json packages/analyzer/

RUN npm install --workspaces

COPY packages/core/ packages/core/
COPY packages/analyzer/ packages/analyzer/

EXPOSE 3010
CMD ["npx", "tsx", "packages/analyzer/src/index.ts"]
