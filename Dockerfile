# One image, one Node process: the built client and Socket.IO on the same port. Litestream
# wraps the process and copies the SQLite database to object storage as it changes.

# --- Build: install, build every package, then keep only the server's production deps.
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
# Optional: client error tracking (fly deploy --build-arg VITE_SENTRY_DSN=...).
ARG VITE_SENTRY_DSN
RUN pnpm build
RUN rm -rf node_modules packages/*/node_modules games/*/*/node_modules \
  && pnpm install --prod --frozen-lockfile --filter @sky/server...

# --- Run: Node, Litestream and the built files only.
FROM node:24-slim
# Root certificates: Litestream (a Go program) needs them to reach R2 over HTTPS. Node has
# its own copy, so the server worked without them; the slim image ships none.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ARG LITESTREAM_VERSION=0.3.13
ADD https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-amd64.tar.gz /tmp/litestream.tar.gz
RUN tar -C /usr/local/bin -xzf /tmp/litestream.tar.gz && rm /tmp/litestream.tar.gz

WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=8080 \
    TRUST_PROXY=1
# The server finds the client at ../../web/dist from its own dist folder.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/server/package.json ./packages/server/package.json
COPY --from=build /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/web/dist ./packages/web/dist
COPY deploy/litestream.yml /etc/litestream.yml
COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 8080
CMD ["/app/start.sh"]
