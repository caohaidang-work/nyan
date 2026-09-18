FROM node:18-bullseye-slim

# Cài đặt Python và yt-dlp bản Linux
RUN apt-get update && apt-get install -y python3 curl ffmpeg && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]