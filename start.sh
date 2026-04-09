#!/bin/bash
# start.sh - Start Snowplow Micro and Next.js server

MODE=$1

if [ "$MODE" != "dev" ] && [ "$MODE" != "prod" ]; then
  echo "Usage: ./start.sh [dev|prod]"
  exit 1
fi

# Load environment variables from .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
  echo "Loaded environment variables from .env.local"
else
  echo "Warning: .env.local file not found"
fi

# Stop and remove existing snowplow-micro container if it exists
if docker ps -a --format '{{.Names}}' | grep -q '^snowplow-micro$'; then
  echo "Removing existing snowplow-micro container..."
  docker rm -f snowplow-micro > /dev/null 2>&1
fi

# Start Snowplow Micro in detached mode.
# Generic schemas (com.snowplow.agent.tracking) resolve from Iglu Central automatically.
# The local mount provides app-specific custom entities (com.snowplow.demo.travel) added in later stages.
echo "Starting Snowplow Micro on port 9090..."
docker run -d --name snowplow-micro \
  -p 9090:9090 \
  -v "$(pwd)/snowplow/iglu-local:/config/iglu-client-embedded" \
  snowplow/snowplow-micro:3.0.1

# Wait a moment for Snowplow Micro to start
sleep 2

# Check if Snowplow Micro is running
if docker ps --format '{{.Names}}' | grep -q '^snowplow-micro$'; then
  echo "Snowplow Micro is running at http://localhost:9090"
  echo "  - Good events: http://localhost:9090/micro/good"
  echo "  - Bad events:  http://localhost:9090/micro/bad"
  echo ""
else
  echo "Failed to start Snowplow Micro"
  exit 1
fi

# Start Next.js server based on mode
if [ "$MODE" == "dev" ]; then
  echo "Starting Next.js dev server..."
  npm run dev
else
  echo "Building and starting Next.js production server..."
  npm run build && npm run start
fi
