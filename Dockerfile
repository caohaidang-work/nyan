FROM node:18-bullseye-slim

# Cài đặt Python và các công cụ cần thiết
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Tải yt-dlp chính thức bản Linux
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Cài đặt thư viện Node
COPY package*.json ./
RUN npm install

# Copy source và build ứng dụng Next.js
COPY . .
RUN npm run build

# Thiết lập cổng và khởi chạy
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]