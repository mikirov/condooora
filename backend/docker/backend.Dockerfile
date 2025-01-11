# Backend Dockerfile (Production)
FROM node:20

# Set working directory
WORKDIR /usr/src/backend

# Install NestJS CLI globally
RUN npm install -g @nestjs/cli

# Copy package.json
COPY package.json package-lock.json ./
COPY .env ./
COPY . .

# Install dependencies, specifically re-building native modules inside Docker
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3002

# Run the app in production mode
# CMD ["npm", "run", "start:prod"]
CMD ["npm", "run", "start:dev"]
