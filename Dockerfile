# Use the official Bun image
FROM oven/bun:latest

# Set the working directory
WORKDIR /app

# Copy package and lock files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy the rest of the application code
COPY . .

# Expose the port your ElysiaJS app runs on (default 3000, change if needed)
EXPOSE 3000

# Start the server
CMD ["bun", "run", "src/index.ts"] 