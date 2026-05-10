FROM node:22-alpine AS build

# make the 'app' folder the current working directory
WORKDIR /app

# ---------------------------------------------------------------------------
# Vite bakes VITE_* variables into the static bundle at build time.
# Pass them as --build-arg flags when running `docker build`.
#
# Required:
#   VITE_API_BASE_URL — full URL of the API Cloud Run service
#                       e.g. https://api-xxxxx-uc.a.run.app
#
# Optional (leave blank to disable):
#   VITE_AZURE_CLIENT_ID              — SPA App Registration client ID
#   VITE_AZURE_TENANT_ID              — Entra ID tenant ID
#   VITE_AZURE_API_SCOPE              — API scope URI for MSAL token requests
#   VITE_APPLICATIONINSIGHTS_CONNECTION_STRING — omit for Phase 1
# ---------------------------------------------------------------------------
ARG VITE_API_BASE_URL=http://localhost:3100
ARG VITE_AZURE_CLIENT_ID=
ARG VITE_AZURE_TENANT_ID=
ARG VITE_AZURE_API_SCOPE=
ARG VITE_APPLICATIONINSIGHTS_CONNECTION_STRING=

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AZURE_CLIENT_ID=$VITE_AZURE_CLIENT_ID
ENV VITE_AZURE_TENANT_ID=$VITE_AZURE_TENANT_ID
ENV VITE_AZURE_API_SCOPE=$VITE_AZURE_API_SCOPE
ENV VITE_APPLICATIONINSIGHTS_CONNECTION_STRING=$VITE_APPLICATIONINSIGHTS_CONNECTION_STRING

COPY . .

# install project dependencies
RUN npm ci
RUN npm run build

FROM nginx:alpine

WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist .
COPY --from=build /app/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["/bin/sh", "-c", "nginx -g \"daemon off;\""]
