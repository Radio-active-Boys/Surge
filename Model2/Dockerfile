# === Stage 1: Build Vite Frontend ===
FROM node:18 AS frontend-build
WORKDIR /app
COPY Frontend/package*.json ./
RUN npm install
COPY Frontend/ .
RUN npm run build


# === Stage 2: Setup Python Backend ===
FROM python:3.11-slim AS backend-build
WORKDIR /app
COPY Backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY Backend/ .

# === Stage 3: Final image with Nginx, Frontend, and Backend ===
FROM nginx:alpine
# Copy built frontend files
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Copy backend code
COPY --from=backend-build /app /app

# Copy Nginx config
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Install Python and gunicorn
RUN apk add --no-cache python3 py3-pip && \
    pip3 install gunicorn flask flask_cors

# Start backend + Nginx
CMD sh -c "gunicorn -w 4 -b 127.0.0.1:5000 app:app & nginx -g 'daemon off;'"
