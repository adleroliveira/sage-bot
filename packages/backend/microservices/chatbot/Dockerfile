FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

CMD [ "node", "dist/src/microservices/chatbot/index.js" ]