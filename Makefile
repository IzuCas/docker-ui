.PHONY: all api app dev clean help build-api build-app electron

# Default target
all: help

# Help message
help:
	@echo "Docker Manager - Development Commands"
	@echo ""
	@echo "Backend (Go API):"
	@echo "  make api           - Run API server directly (requires Go)"
	@echo "  make build-api     - Build API binary"
	@echo ""
	@echo "Frontend (React):"
	@echo "  make app           - Run frontend dev server"
	@echo "  make build-app     - Build frontend for production"
	@echo ""
	@echo "Electron:"
	@echo "  make electron-dev  - Run Electron app in development mode"
	@echo "  make electron      - Build Electron app for current platform"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up     - Start all services with Docker Compose"
	@echo "  make docker-down   - Stop all Docker services"
	@echo "  make docker-build  - Build Docker images"
	@echo ""
	@echo "Development:"
	@echo "  make dev           - Run API and frontend together (no Docker)"
	@echo "  make clean         - Clean build artifacts"

# Run API directly
api:
	cd api && go run ./cmd/api

# Build API binary
build-api:
	cd api && go build -o bin/api ./cmd/api

# Run frontend dev server
app:
	cd app && npm run dev

# Build frontend
build-app:
	cd app && npm run build

# Run both API and frontend (development mode without Docker)
dev:
	@echo "Starting API and Frontend in development mode..."
	@echo "API will be available at http://localhost:8001"
	@echo "Frontend will be available at http://localhost:3000"
	@trap 'kill 0' SIGINT; \
	(cd api && go run ./cmd/api) & \
	(cd app && npm run dev) & \
	wait

# Electron development
electron-dev:
	cd app && npm run dev:electron

# Build Electron app
electron:
	cd api && go build -o bin/api ./cmd/api
	cd app && npm run electron:build

# Docker commands
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-build:
	docker compose build

# Clean build artifacts
clean:
	rm -rf api/bin
	rm -rf app/dist
	rm -rf app/release
	rm -rf app/electron/*.js
	rm -rf app/electron/*.js.map
