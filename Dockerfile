FROM node:22
WORKDIR /app
RUN npm install -g pnpm@11.18.0
COPY . .
CMD ["pnpm", "--filter", "@operaia/api", "start"]
