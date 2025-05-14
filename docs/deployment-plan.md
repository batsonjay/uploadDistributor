# Deployment Plan: uploadDistributor

## Development vs Production Environments

### Local Development Setup

The development environment runs directly on your local machine:

```bash
# Terminal 1: Run the daemon
cd packages/daemon
npm run dev  # Runs on localhost:3001

# Terminal 2: Run the web client
cd apps/web-ui
npm run dev  # Runs on localhost:3000
```

Key development environment characteristics:
- Services run directly with Node/npm (no containers)
- Uses localhost URLs for communication
- Files stored in project directory structure
- Mock APIs enabled by default (controlled by USE_MOCK_APIS in .env)
- CORS configured for localhost development
- Hot reloading enabled for rapid development

Required development environment variables:
```bash
# In packages/daemon/.env
USE_MOCK_APIS=true
PORT=3001

# In apps/web-ui/.env
NEXT_PUBLIC_DAEMON_URL=http://localhost:3001
```

### Transitioning to Production

Key differences in production:
1. Daemon:
   - Runs in Docker container on Linode
   - Uses real APIs instead of mocks
   - Proper file storage paths
   - Production CORS settings
   - No hot reloading

2. Web Client:
   - Deployed to Vercel or similar platform
   - Points to production daemon URL
   - Production environment variables
   - Static file serving

Steps to transition from development to production:
1. Update daemon environment variables:
   ```bash
   USE_MOCK_APIS=false
   USE_REAL_AZURACAST=true
   # Update other API settings as needed
   ```

2. Update web client environment variables:
   ```bash
   NEXT_PUBLIC_DAEMON_URL=https://your-production-daemon-url
   ```

3. Configure CORS in daemon for production web client domain
4. Follow deployment steps below for daemon containerization
5. Deploy web client to hosting platform

## Overview

The uploadDistributor daemon will be deployed as a separate Docker container on the same Linode instance that hosts AzuraCast. This approach provides:

- Cost efficiency (no additional Linode instance required)
- Isolation between applications
- Independent update cycles
- Ability to communicate with AzuraCast via internal Docker networking

## Prerequisites

- A Linode instance running AzuraCast in Docker containers
- SSH access to the Linode instance
- Basic knowledge of Docker and Docker Compose
- Administrator access to AzuraCast

## Deployment Steps

### 1. SSH Access to Your Linode

Connect to your Linode instance via SSH:

```bash
ssh username@your-linode-ip
```

### 2. Create a Directory for the uploadDistributor

Create a separate directory for the uploadDistributor project:

```bash
mkdir -p /var/uploadDistributor
cd /var/uploadDistributor
```

### 3. Set Up Docker Compose for uploadDistributor

Create a `docker-compose.yml` file for the uploadDistributor:

```bash
nano docker-compose.yml
```

Add the following content:

```yaml
version: '3'

services:
  daemon:
    build: 
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    volumes:
      - ./received-files:/app/packages/daemon/received-files
      - ./songlists:/app/packages/songlists
      - ./logs:/app/packages/daemon/logs
    environment:
      - NODE_ENV=production
      - PORT=3001
      - RECEIVED_FILES_DIR=/app/packages/daemon/received-files
      - AZURACAST_API_URL=http://azuracast:80
      - AZURACAST_API_KEY=your-api-key-here
      - AZURACAST_STATION_ID=2
      # Add other environment variables as needed
    restart: unless-stopped
    networks:
      - default
      - azuracast_internal

networks:
  default:
    driver: bridge
  azuracast_internal:
    external: true
    # Note: You'll need to replace 'azuracast_internal' with the actual network name
    # used by your AzuraCast installation
```

### 4. Create a Dockerfile

Create a Dockerfile for the uploadDistributor:

```bash
nano Dockerfile
```

Add the following content:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY turbo.json ./
COPY .npmrc ./

# Copy shared packages
COPY packages/shared ./packages/shared
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config

# Copy daemon package
COPY packages/daemon ./packages/daemon

# Install dependencies
RUN npm install

# Build the project
RUN npm run build

# Create necessary directories
RUN mkdir -p packages/daemon/received-files
RUN mkdir -p packages/daemon/logs
RUN mkdir -p packages/songlists

# Expose the daemon port
EXPOSE 3001

# Start the daemon
CMD ["node", "packages/daemon/dist/index.js"]
```

### 5. Connect to AzuraCast's Network

To enable communication between the uploadDistributor and AzuraCast:

1. Find AzuraCast's network name:

```bash
cd /var/azuracast
docker network ls
```

Look for a network with a name like `azuracast_default` or similar.

2. Update the `docker-compose.yml` file to use the correct network name:

```yaml
networks:
  default:
    driver: bridge
  azuracast_default:  # Replace with the actual network name from step 1
    external: true
```

3. Update the `AZURACAST_API_URL` in the `docker-compose.yml` file to use the internal Docker service name:

```yaml
environment:
  - AZURACAST_API_URL=http://web:80  # Replace 'web' with the actual service name
```

To find the correct service name, you can examine AzuraCast's docker-compose.yml file:

```bash
cd /var/azuracast
cat docker-compose.yml
```

### 6. Prepare the Project Files

There are two options for getting the project files onto the server:

#### Option A: Clone from Git Repository

```bash
cd /var/uploadDistributor
git clone https://your-repository-url.git .
```

#### Option B: Build Locally and Transfer

1. Build the project locally:

```bash
npm run build
```

2. Create a tarball of the necessary files:

```bash
tar -czf uploadDistributor.tar.gz \
  package.json package-lock.json turbo.json .npmrc \
  packages/shared packages/typescript-config packages/eslint-config \
  packages/daemon
```

3. Transfer the tarball to the server:

```bash
scp uploadDistributor.tar.gz username@your-linode-ip:/var/uploadDistributor/
```

4. Extract the tarball on the server:

```bash
cd /var/uploadDistributor
tar -xzf uploadDistributor.tar.gz
```

### 7. Create Required Directories

Create the necessary directories for file storage:

```bash
mkdir -p /var/uploadDistributor/received-files
mkdir -p /var/uploadDistributor/songlists
mkdir -p /var/uploadDistributor/logs
```

### 8. Configure Environment Variables

Create a `.env` file with the necessary environment variables:

```bash
nano .env
```

Add the following content, adjusting values as needed:

```
# Server Configuration
PORT=3001
NODE_ENV=production

# API Mode (mock vs real)
USE_MOCK_APIS=false

# AzuraCast Configuration
USE_REAL_AZURACAST=true
AZURACAST_API_URL=http://web:80  # Replace with the actual service name
AZURACAST_API_KEY=your-api-key-here
AZURACAST_STATION_ID=2

# Mixcloud Configuration
USE_REAL_MIXCLOUD=true
MIXCLOUD_API_URL=https://api.mixcloud.com
MIXCLOUD_API_KEY=your-api-key-here

# SoundCloud Configuration
USE_REAL_SOUNDCLOUD=true
SOUNDCLOUD_API_URL=https://api.soundcloud.com
SOUNDCLOUD_API_KEY=your-api-key-here

# Logging
LOG_LEVEL=info

# File Storage
RECEIVED_FILES_DIR=./received-files
TEMP_DIR=./temp
```

### 9. Start the Container

Build and start the Docker container:

```bash
cd /var/uploadDistributor
docker-compose up -d
```

### 10. Verify the Deployment

Check if the container is running:

```bash
docker-compose ps
```

Check the logs for any errors:

```bash
docker-compose logs
```

Test the API endpoint:

```bash
curl http://localhost:3001/health
```

## Maintenance

### Updating the Application

To update the application:

1. Pull the latest changes (if using Git):

```bash
cd /var/uploadDistributor
git pull
```

2. Or upload new files (if transferring manually)

3. Rebuild and restart the container:

```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### Backup Strategy

Regularly back up the following directories:

- `/var/uploadDistributor/received-files` - Contains received audio files
- `/var/uploadDistributor/songlists` - Contains processed songlist data
- `/var/uploadDistributor/logs` - Contains application logs

Example backup command:

```bash
tar -czf uploadDistributor-backup-$(date +%Y%m%d).tar.gz \
  /var/uploadDistributor/received-files \
  /var/uploadDistributor/songlists \
  /var/uploadDistributor/logs
```

## Troubleshooting

### Container Won't Start

Check the logs for errors:

```bash
docker-compose logs
```

### Network Connectivity Issues

Verify the Docker network configuration:

```bash
docker network inspect azuracast_default  # Replace with your network name
```

Ensure the container is connected to the network:

```bash
docker network connect azuracast_default uploadDistributor_daemon_1
```

### API Connection Issues

Test the connection to AzuraCast from within the container:

```bash
docker-compose exec daemon curl http://web:80  # Replace 'web' with the actual service name
```

## Resource Considerations

The uploadDistributor and AzuraCast will share the resources of your Linode instance. Monitor resource usage to ensure neither application is starved of resources:

```bash
docker stats
```

If resource contention becomes an issue, consider:

1. Upgrading your Linode instance to a larger plan
2. Adjusting resource limits in the docker-compose.yml file:

```yaml
services:
  daemon:
    # ... other configuration
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

## Security Considerations

1. Ensure the API endpoint is properly secured
2. Use strong API keys
3. Consider setting up a reverse proxy with SSL
4. Restrict access to the API endpoint to trusted IPs if possible

## Conclusion

This deployment plan provides a cost-effective way to run the uploadDistributor alongside AzuraCast on the same Linode instance. By using Docker containers, we maintain isolation between the applications while enabling them to communicate efficiently.
