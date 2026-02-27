#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment..."

# 1. Git pull
echo "📥 Pulling latest changes..."
# Store the current commit hash before pulling
PREVIOUS_COMMIT=$(git rev-parse HEAD)
git pull origin main

# 2. Check for changes in frontend
echo "🔍 Checking frontend changes..."
if ! git diff --quiet $PREVIOUS_COMMIT HEAD -- frontend/; then
    echo "🏗️ Frontend changes detected. Building frontend..."
    cd frontend
    npm install
    npm run build
    cd ..
else
    echo "✅ No frontend changes detected."
fi

# 3. Check for changes in backend
echo "🔍 Checking backend changes..."
# We check the backend/ directory and root package files
if ! git diff --quiet $PREVIOUS_COMMIT HEAD -- backend/ package.json package-lock.json; then
    echo "⚙️ Backend changes detected. Building and restarting..."
    npm install
    npm run build
    
    # Check if pm2 is running the process
    if pm2 list | grep -q "pagelm-backend"; then
        echo "🔄 Restarting pagelm-backend via PM2..."
        pm2 restart pagelm-backend
    else
        echo "▶️ Starting pagelm-backend via PM2..."
        # Using the start script from package.json
        pm2 start npm --name "pagelm-backend" -- run start
    fi
else
    echo "✅ No backend changes detected."
fi

echo "✨ Deployment finished successfully!"
