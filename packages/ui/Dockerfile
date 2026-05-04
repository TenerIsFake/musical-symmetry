FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY packages/core/package.json packages/core/
COPY packages/ui/package.json packages/ui/

RUN npm install --workspaces

COPY packages/core/ packages/core/
COPY packages/ui/ packages/ui/

RUN npm run build -w packages/ui

FROM nginx:alpine
COPY packages/ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/ui/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
