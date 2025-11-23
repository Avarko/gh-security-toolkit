.PHONY: help dev dev-localstack build preview clean install test-data typecheck \
        localstack-start localstack-stop localstack-setup localstack-logs localstack-dev

help:
	@echo "Dashboard Development Commands:"
	@echo ""
	@echo "  make dev             - Start development server (localhost:5173)"
	@echo "  make dev-localstack  - Start dev server with LocalStack S3 data"
	@echo "  make build           - Build production static files"
	@echo "  make preview         - Preview production build locally"
	@echo "  make typecheck       - Run TypeScript type check"
	@echo "  make install         - Install dependencies"
	@echo "  make test-data       - Generate realistic test scan history"
	@echo "  make clean           - Remove build artifacts"
	@echo ""
	@echo "LocalStack Commands (S3 development):"
	@echo ""
	@echo "  make localstack-start  - Start LocalStack container"
	@echo "  make localstack-stop   - Stop LocalStack container"
	@echo "  make localstack-setup  - Initialize S3 buckets with test data"
	@echo "  make localstack-logs   - View LocalStack container logs"
	@echo "  make localstack-dev    - Full LocalStack dev workflow (start + setup + dev)"
	@echo ""

dev:
	@echo "Starting dashboard development server..."
	npm run dev

dev-localstack:
	@echo "Starting dashboard with LocalStack S3..."
	npm run dev:localstack

build:
	@echo "Building production dashboard..."
	npm run build

preview:
	@echo "Previewing production build..."
	npm run preview

typecheck:
	@echo "Performing TypeScript typecheck..."
	npm run typecheck

install:
	@echo "Installing dependencies..."
	npm install

test-data:
	@echo "Generating realistic test scan history..."
	@mkdir -p public/data/hist
	@../scripts/generate-test-scan-history.sh public/data/hist/scan-history.json nightly
	@echo "Test data generated at public/data/hist/scan-history.json"

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf build/
	@rm -rf node_modules/.vite/
	@rm -rf localstack-data/
	@echo "Clean complete"

# LocalStack commands
localstack-start:
	@echo "Starting LocalStack..."
	npm run localstack:start
	@echo "Waiting for LocalStack to be ready..."
	@sleep 5

localstack-stop:
	@echo "Stopping LocalStack..."
	npm run localstack:stop

localstack-setup:
	@echo "Setting up LocalStack S3 buckets..."
	npm run localstack:setup

localstack-logs:
	npm run localstack:logs

localstack-dev: localstack-start localstack-setup dev-localstack
