# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Afnkit — multi-stage image for the example server.
#
# Afnkit has ZERO runtime dependencies, so the runtime image needs only the
# compiled JavaScript from `dist/` plus a Node.js runtime — no node_modules.
# ---------------------------------------------------------------------------

# ---------------------------- Build stage ----------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Copy the dependency manifests first so this layer stays cached unless the
# manifests change. A lockfile is present, so `npm ci` gives a reproducible,
# byte-for-byte install of the dev dependencies required to compile TypeScript.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the compiler configuration and the sources, then compile with the
# project's own build script (tsc -p tsconfig.json -> dist/).
COPY tsconfig.json ./
COPY src ./src
COPY examples ./examples
COPY tests ./tests
RUN npm run build

# --------------------------- Runtime stage ---------------------------------
FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

# tini is a tiny init: as PID 1 it forwards SIGTERM/SIGINT to the Node process
# so `docker stop` triggers a clean shutdown (a Node process running as PID 1
# would otherwise ignore those signals), and it reaps orphaned children.
RUN apk add --no-cache tini

# Copy only the compiled files the server actually needs. `dist/examples/basic.js`
# requires `../src/index`, so both trees are copied to preserve the layout.
# Compiled tests are intentionally not copied.
COPY --from=build /app/dist/src ./dist/src
COPY --from=build /app/dist/examples ./dist/examples
COPY package.json ./

# Document the port the example listens on (see examples/basic.ts).
EXPOSE 3000

# Run as the unprivileged `node` user that ships with the official image.
USER node

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/examples/basic.js"]
