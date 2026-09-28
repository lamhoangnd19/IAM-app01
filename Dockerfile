FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY public ./public
COPY scripts ./scripts
COPY src ./src
COPY views ./views

ENV NODE_ENV=production
EXPOSE 3000

RUN chown -R node:node /app
USER node

CMD ["npm", "start"]
