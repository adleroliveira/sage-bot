FROM node:20
ARG CACHE_BUST

WORKDIR /usr/src/app

# Copy root package.json and workspace package.json files
COPY package.json .
COPY packages/backend/package.json ./packages/backend/

# Install dependencies
RUN npm install

# Copy the backend code
COPY packages/backend ./packages/backend

# Build the backend
RUN npm run build:backend

# Prune dev dependencies
RUN npm prune --production

WORKDIR /usr/src/app/packages/backend

EXPOSE 8080

CMD [ "node", "dist/microservices/websockets/index.js" ]