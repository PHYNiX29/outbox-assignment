# Single image: builds the React app and the API; Express serves both on one domain.
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY backend/package*.json backend/
RUN cd backend && npm ci --ignore-scripts

COPY frontend frontend
RUN cd frontend && npm run build

COPY backend backend
RUN cd backend && npx prisma generate && npm run build

ENV NODE_ENV=production
WORKDIR /app/backend
# Apply DB migrations, then start API + worker. `exec` so SIGTERM reaches Node for graceful shutdown.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/server.js"]
