# Use official Node.js image (Debian-based: canvas has prebuilt glibc binaries)
FROM node:22-slim

# Set working directory inside container
WORKDIR /app

# Install runtime + build dependencies required by `canvas` (and face-api.js).
# build-essential + python3 + pkg-config are a fallback in case canvas has to
# compile from source; the cairo/pango/jpeg/gif/rsvg libs are needed at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

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
