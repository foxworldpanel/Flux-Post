FROM node:18-slim

# Instalar FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Healthcheck to verify the worker is running and the main process hasn't crashed
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD pgrep -f "node index.js" || exit 1

CMD ["node", "index.js"]
