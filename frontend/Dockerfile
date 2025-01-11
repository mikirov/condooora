# Use an official Node.js runtime as a parent image
FROM node:18-alpine as build

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the React application
RUN npm run build

# Use a lightweight web server to serve the build
FROM nginx:alpine

# Copy the build output to Nginx's default HTML directory
COPY --from=build /app/build /usr/share/nginx/html

# Replace the default Nginx configuration with a custom one
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose the desired port
EXPOSE 3001

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]