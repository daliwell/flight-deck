# Use Node.js 18 on Debian for Brother printer driver compatibility
FROM node:18

# Set working directory
WORKDIR /app

# Install system dependencies for Brother printer
RUN apt-get update && apt-get install -y \
    cups \
    libcups2 \
    libcupsimage2 \
    bluetooth \
    bluez \
    libbluetooth-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy Brother QL-820NWB printer driver
COPY drivers/ql820nwbpdrv-3.1.5-0.i386.deb /tmp/brother-printer.deb

# Install Brother printer driver
RUN dpkg -i /tmp/brother-printer.deb || apt-get install -f -y \
    && rm /tmp/brother-printer.deb

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user for security
RUN groupadd -g 1001 nodejs
RUN useradd -r -u 1001 -g nodejs nodeuser

# Change ownership of the app directory
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
CMD ["npm", "start"]
