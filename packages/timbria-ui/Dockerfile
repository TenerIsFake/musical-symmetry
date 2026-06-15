FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY packages/timbria-ui/package.json packages/timbria-ui/

RUN npm install --workspaces

COPY packages/timbria-ui/ packages/timbria-ui/

RUN npm run build -w packages/timbria-ui

FROM nginx:alpine
COPY packages/timbria-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/timbria-ui/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
