#!/bin/bash

# Configuration
HUB_PATH="$HOME/.gemini/agent_hub"
CURRENT_DIR="$(pwd)"
AGENT_DIR=".agent"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🤖 Agent Hub Manager${NC}"
echo "----------------------"

# Function to Sync (Source -> Hub)
sync_to_hub() {
    if [ ! -d "$CURRENT_DIR/$AGENT_DIR" ]; then
        echo -e "${RED}❌ Error: No .agent directory found in current project!${NC}"
        echo "Please run this command from the root of the 'Simulacra' (source) project."
        exit 1
    fi

    echo "Syncing skills from $CURRENT_DIR to $HUB_PATH..."
    mkdir -p "$HUB_PATH"
    
    # Use rsync to copy, creating directory structure if needed
    # --delete removes files in Hub that were deleted in Source
    rsync -av --delete "$CURRENT_DIR/$AGENT_DIR" "$HUB_PATH/"

    echo -e "${GREEN}✅ Success! Skills synced to Central Hub.${NC}"
    echo "Location: $HUB_PATH"
}

# Function to Install (Hub -> Target)
install_to_project() {
    if [ ! -d "$HUB_PATH/$AGENT_DIR" ]; then
        echo -e "${RED}❌ Error: Central Hub is empty!${NC}"
        echo "Run './agent_hub.sh sync' from your source project first."
        exit 1
    fi

    echo "Installing Agent Skills to $CURRENT_DIR..."
    
    # Check if .agent already exists
    if [ -d "$CURRENT_DIR/$AGENT_DIR" ]; then
        echo -e "${BLUE}ℹ️  Updating existing .agent directory...${NC}"
    fi

    rsync -av "$HUB_PATH/$AGENT_DIR/" "$CURRENT_DIR/$AGENT_DIR/"

    echo -e "${GREEN}✅ Success! Agentic Factory installed in this project.${NC}"
    echo "You can now use commands like:"
    echo "  > /feature_factory"
    echo "  > /image_to_code"
}

# Main Logic
case "$1" in
    sync)
        sync_to_hub
        ;;
    install)
        install_to_project
        ;;
    *)
        echo "Usage: $0 {sync|install}"
        echo ""
        echo "Commands:"
        echo "  sync     : Push current .agent folder to Central Hub ($HUB_PATH)"
        echo "  install  : Pull skills from Central Hub into current project"
        exit 1
        ;;
esac
