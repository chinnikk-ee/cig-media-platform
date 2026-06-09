# Stage 1 — Build the React app
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Build with an empty VITE_API_URL so the app uses relative paths (/api, same-origin
# socket). nginx then proxies those to the backend container — a fully self-contained
# local stack with no dependency on the remote Render backend.
RUN echo "VITE_API_URL=" > .env.production && npm run build

# Stage 2 — Serve with nginx
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
