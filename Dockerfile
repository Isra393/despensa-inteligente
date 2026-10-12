FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY index.js ./
COPY servidor ./servidor
COPY cliente ./cliente

ENV NODE_ENV=production

USER node

CMD ["npm", "start"]