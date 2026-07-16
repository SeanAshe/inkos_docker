# ── Dockerfile for InkOS Story Creation AI Agent ──
# https://github.com/SeanAshe/inkos_docker

FROM node:22-bookworm-slim

ARG INKOS_VERSION=latest

LABEL org.opencontainers.image.title="InkOS" \
      org.opencontainers.image.description="Story Creation AI Agent — long-form fiction, short stories, scripts, interactive games" \
      org.opencontainers.image.source="https://github.com/SeanAshe/inkos_docker" \
      org.opencontainers.image.license="AGPL-3.0-only"

ENV NODE_ENV=production \
    STUDIO_PORT=4567

RUN npm install -g @actalk/inkos@${INKOS_VERSION} \
    && npm cache clean --force \
    && groupmod -g 1000 node \
    && usermod -u 1000 -g 1000 -d /workspace node \
    && mkdir -p /workspace \
    && chown -R node:node /workspace

USER node
WORKDIR /workspace

VOLUME ["/workspace"]

EXPOSE ${STUDIO_PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.STUDIO_PORT+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "inkos studio -p ${STUDIO_PORT:-4567}"]
