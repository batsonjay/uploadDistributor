#!/bin/bash

# brund.sh - Build and Run Daemon
# This script builds the logging and daemon packages, then starts the daemon

# Set script to exit on error
set -e

# Print colored output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Building and running daemon...${NC}"

# Get the absolute path to the project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

# Step 1: Build the logging package
echo -e "${GREEN}Step 1: Building logging package...${NC}"
cd "$PROJECT_ROOT/packages/logging" && npm run build

# Step 2: Build the daemon package
echo -e "${GREEN}Step 2: Building daemon package...${NC}"
cd "$PROJECT_ROOT/packages/daemon" && npm run build

# Step 3: Start the daemon
echo -e "${GREEN}Step 3: Starting daemon...${NC}"
cd "$PROJECT_ROOT/packages/daemon" && npm run start

echo -e "${YELLOW}Done!${NC}"
