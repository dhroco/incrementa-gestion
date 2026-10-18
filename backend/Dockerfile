FROM node:22-slim

WORKDIR /app

# production: Express no devuelve el stack en un error. PORT: Container Apps no lo inyecta.
ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

RUN chown -R node:node /app

USER node

EXPOSE 8080

CMD ["node", "index.js"]
