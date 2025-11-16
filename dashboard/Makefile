.PHONY: help dev build preview clean install test-data

help:
	@echo "Dashboard Development Commands:"
	@echo ""
	@echo "  make dev           - Start development server (localhost:5173)"
	@echo "  make build         - Build production static files"
	@echo "  make preview       - Preview production build locally"
	@echo "  make install       - Install dependencies"
	@echo "  make test-data     - Generate realistic test scan history"
	@echo "  make clean         - Remove build artifacts"
	@echo ""

dev:
	@echo "🚀 Starting dashboard dev server..."
	npm run dev

build:
	@echo "🏗️  Building production dashboard..."
	npm run build

preview:
	@echo "👁️  Previewing production build..."
	npm run preview

install:
	@echo "📦 Installing dependencies..."
	npm install

test-data:
	@echo "🎲 Generating realistic test scan history..."
	@mkdir -p public/data/hist
	@../scripts/generate-test-scan-history.sh public/data/hist/scan-history.json nightly
	@echo "✅ Test data generated at public/data/hist/scan-history.json"

clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf build/
	@rm -rf node_modules/.vite/
	@echo "✅ Clean complete"
