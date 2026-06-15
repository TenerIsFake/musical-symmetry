FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY packages/timbria-ui/package.json packages/timbria-ui/

RUN npm install --workspaces

COPY packages/timbria-ui/ packages/timbria-ui/

# Kiwix (offline Wikipedia) base + book id — baked into the static build.
ARG VITE_KIWIX_BASE=https://kiwix.tendrid.us
ARG VITE_KIWIX_WIKI_ID=53a8f711-f7f9-ec23-08fc-38fcf579ba32
ENV VITE_KIWIX_BASE=$VITE_KIWIX_BASE
ENV VITE_KIWIX_WIKI_ID=$VITE_KIWIX_WIKI_ID

RUN npm run build -w packages/timbria-ui

FROM nginx:alpine
COPY packages/timbria-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/timbria-ui/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
