FROM node:20-slim


# Install pnpm globally
RUN npm install -g pnpm@9

# Set working directory inside the container
WORKDIR /app

# Copy package files to the working directory
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy the entire project
COPY . .

# Build the project (compiles TS to JS in dist/)
RUN pnpm build

# Expose Hono's port
EXPOSE 9999

# Start the production server
CMD ["pnpm", "start"]