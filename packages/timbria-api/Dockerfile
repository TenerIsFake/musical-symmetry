FROM node:20-alpine
# ffmpeg: required by byear/audio-normalize.ts to decode uploaded clips to 16kHz mono PCM
RUN apk add --no-cache python3 make g++ su-exec ffmpeg
WORKDIR /app

COPY package.json ./
COPY packages/timbria-api/package.json packages/timbria-api/

RUN npm install --workspaces

COPY packages/timbria-api/ packages/timbria-api/

EXPOSE 3061
CMD ["sh", "-c", "chown -R node:node /data && exec su-exec node npx tsx packages/timbria-api/src/index.ts"]
