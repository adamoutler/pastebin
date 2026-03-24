FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y \
    git \
    xvfb \
    cutycapt \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/pastebin

COPY package*.json ./
RUN npm install

COPY . /opt/pastebin/

EXPOSE 7777
CMD ["npm", "start"]
