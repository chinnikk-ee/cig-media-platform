# Use official Node.js image
FROM node:22-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy rest of backend code
COPY . .

# Expose port
EXPOSE 5000

# Start the server
CMD ["node", "src/server.js"]
