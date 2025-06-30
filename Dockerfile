FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy rest of source code
COPY . .

# Create uploads directory
RUN mkdir -p public/uploads

# Expose port
EXPOSE 3000

# Default command (can be overridden in docker-compose)
CMD ["npm", "run", "dev"]