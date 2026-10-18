FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY packages/core/package.json packages/core/
COPY packages/ui/package.json packages/ui/
# Native-only (iOS CoreMIDI), but packages/ui depends on it, so npm must find
# the workspace or it falls through to the registry and 404s. No JS to copy.
COPY packages/capacitor-coremidi/package.json packages/capacitor-coremidi/

RUN npm install --workspaces

COPY packages/core/ packages/core/
COPY packages/ui/ packages/ui/

ARG VITE_ADSENSE_CLIENT=""
ENV VITE_ADSENSE_CLIENT=$VITE_ADSENSE_CLIENT

RUN npm run build -w packages/ui

FROM nginx:alpine
COPY packages/ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/ui/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
