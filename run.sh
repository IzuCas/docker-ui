#!/bin/bash

# Docker Manager - Development Scripts
# This script allows running the application without Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR/api"
APP_DIR="$SCRIPT_DIR/app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_help() {
    echo "Docker Manager - Development Scripts"
    echo ""
    echo "Usage: ./run.sh [command]"
    echo ""
    echo "Commands:"
    echo "  api         Run the Go API server"
    echo "  app         Run the React frontend dev server"
    echo "  dev         Run both API and frontend"
    echo "  electron    Run the Electron app"
    echo "  build       Build everything for production"
    echo "  help        Show this help message"
    echo ""
}

check_go() {
    if ! command -v go &> /dev/null; then
        echo -e "${RED}Error: Go is not installed. Please install Go 1.21+${NC}"
        exit 1
    fi
}

check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js is not installed. Please install Node.js 18+${NC}"
        exit 1
    fi
}

run_api() {
    check_go
    echo -e "${GREEN}Starting API server...${NC}"
    cd "$API_DIR"
    go run ./cmd/api
}

run_app() {
    check_node
    echo -e "${GREEN}Starting frontend dev server...${NC}"
    cd "$APP_DIR"
    npm run dev
}

run_dev() {
    check_go
    check_node
    
    echo -e "${GREEN}Starting development environment...${NC}"
    echo -e "${YELLOW}API: http://localhost:8001${NC}"
    echo -e "${YELLOW}Frontend: http://localhost:3000${NC}"
    echo ""
    
    # Start API in background
    (cd "$API_DIR" && go run ./cmd/api) &
    API_PID=$!
    
    # Start frontend in background
    (cd "$APP_DIR" && npm run dev) &
    APP_PID=$!
    
    # Handle cleanup on exit
    trap "echo ''; echo -e '${YELLOW}Shutting down...${NC}'; kill $API_PID $APP_PID 2>/dev/null; exit" SIGINT SIGTERM
    
    wait
}

run_electron() {
    check_go
    check_node
    
    echo -e "${GREEN}Building API binary...${NC}"
    cd "$API_DIR"
    go build -o bin/api ./cmd/api
    
    echo -e "${GREEN}Starting Electron app...${NC}"
    cd "$APP_DIR"
    npm run electron:dev
}

build_all() {
    check_go
    check_node
    
    echo -e "${GREEN}Building API...${NC}"
    cd "$API_DIR"
    go build -o bin/api ./cmd/api
    
    echo -e "${GREEN}Building frontend...${NC}"
    cd "$APP_DIR"
    npm run build
    
    echo -e "${GREEN}Build complete!${NC}"
}

# Main script logic
case "${1:-help}" in
    api)
        run_api
        ;;
    app)
        run_app
        ;;
    dev)
        run_dev
        ;;
    electron)
        run_electron
        ;;
    build)
        build_all
        ;;
    help|--help|-h)
        print_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        print_help
        exit 1
        ;;
esac
