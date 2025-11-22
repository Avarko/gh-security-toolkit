.PHONY: help dashboard-dev dashboard-build dashboard-test-data dashboard-clean

help:
	@echo "GitHub Security Toolkit - Development Commands"
	@echo ""
	@echo "Dashboard Commands:"
	@echo "  make dashboard-dev         - Start dashboard dev server (localhost:5173)"
	@echo "  make dashboard-build       - Build production dashboard"
	@echo "  make dashboard-test-data   - Generate realistic test scan data"
	@echo "  make dashboard-clean       - Clean dashboard build artifacts"
	@echo ""
	@echo "For more dashboard commands, see: cd dashboard && make help"
	@echo ""

# Dashboard commands (delegated to dashboard/Makefile)
dashboard-dev:
	@$(MAKE) -C dashboard dev

dashboard-build:
	@$(MAKE) -C dashboard build

dashboard-test-data:
	@$(MAKE) -C dashboard test-data

dashboard-clean:
	@$(MAKE) -C dashboard clean
