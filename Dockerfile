FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY backend/package.json ./backend/
RUN cd backend && npm install --omit=dev
COPY backend/ ./backend/
COPY --from=frontend /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data
EXPOSE 8080
CMD ["node", "backend/src/index.js"]
