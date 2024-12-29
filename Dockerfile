# Use the official Node.js 20 LTS Alpine image as the base
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package.json package-lock.json ./

# Install app dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Remove development dependencies (if any)
# RUN npm prune --production

# Expose the port that the app listens on
# Azure uses the PORT environment variable to assign the port
EXPOSE 8080

# Define environment variable for Node.js to run in production
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"]