FROM hub.zhongshu.tech/public/node:24.22.2-slim-pnpm10-git-py3 AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
ARG BUILD_SCRIPT=build:prod
RUN npm run ${BUILD_SCRIPT}

# Pure static frontend, published by Nginx at the configured context path.
FROM hub.zhongshu.tech/public/nginx:1.30.6-alpine-slim AS frontend
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 deploy/15-context-path.sh /docker-entrypoint.d/15-context-path.sh
ENV SHIP_CONTEXT_PATH=ship-smart-engine-room NGINX_ENVSUBST_FILTER=SHIP_CONTEXT_PATH TZ=Asia/Shanghai
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD curl --fail --silent http://127.0.0.1/healthz || exit 1

# Backend: Node APIs and Python analysis. No Alpine/glibc mismatch.
FROM hub.zhongshu.tech/public/node:24.22.2-slim-pnpm10-git-py3 AS backend
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv libgomp1 ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/ship-python
ENV PATH=/opt/ship-python/bin:$PATH PYTHONUNBUFFERED=1 PYTHONUTF8=1 \
    PYTHONDONTWRITEBYTECODE=1 TZ=Asia/Shanghai NODE_ENV=production \
    HOST=0.0.0.0 PORT=5173 SHIP_CONTEXT_PATH=ship-smart-engine-room SHIP_PYTHON=/opt/ship-python/bin/python \
    SHIP_DATA_DIR=/app/runtime SHIP_TELEMETRY_DIR=/app/deployment-data/telemetry \
    SHIP_AI_DIR=/app/runtime/ai SHIP_AI_SEED_FILE=/app/.local-ai/config.json \
    SHIP_REQUIRE_TELEMETRY=true
WORKDIR /app
COPY requirements-local.txt ./
# CPU wheels avoid shipping a CUDA runtime to the company server.
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
RUN pip install --no-cache-dir -r requirements-local.txt
RUN pip install --no-cache-dir 'torch>=2.2,<3' --index-url https://download.pytorch.org/whl/cpu
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev
COPY --chown=node:node server ./server
COPY --chown=node:node src ./src
COPY --chown=node:node data ./data
COPY --chown=node:node docs/device-type-template.json ./docs/device-type-template.json
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node .claude ./.claude
COPY --chown=node:node wiki_rt-flex50 ./wiki_rt-flex50
COPY --chown=node:node .local-ai/config.json ./.local-ai/config.json
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node deployment-data ./deployment-data
RUN mkdir -p /app/runtime && chown -R node:node /app/runtime
# Public browser origin is configurable; proxy addresses and upstream Host may vary.
ENV SHIP_REQUEST_MODE=web SHIP_PUBLIC_ORIGIN=https://dev.zhongshu.tech
USER node
EXPOSE 5173
VOLUME ["/app/runtime"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/local-server.mjs"]
