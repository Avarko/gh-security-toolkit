localstack-list:
	@echo "Listing contents of all LocalStack S3 buckets..."
	@AWS_ENDPOINT_URL=${AWS_ENDPOINT_URL:-http://localhost:4566} \
	AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-test} \
	AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-test} \
	AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-us-east-1} \
	for bucket in $(shell aws --endpoint-url=$${AWS_ENDPOINT_URL} s3api list-buckets --query "Buckets[].Name" --output text); do \
	  echo "--- $$bucket ---"; \
	  aws --endpoint-url=$${AWS_ENDPOINT_URL} s3 ls s3://$$bucket/ --recursive; \
	done
# Local development Makefile

.PHONY: bootstrap scan-sim test-report-sim dashboard clean localstack localstack-setup localstack-start localstack-stop

bootstrap:
	@mkdir -p local-dev/data/test-tenant-uuid-001/hist
	@mkdir -p local-dev/data/test-tenant-uuid-001/runs
	@cp scripts/test-fixtures/scan-history.json local-dev/data/test-tenant-uuid-001/hist/scan-history.json

scan-sim:
	bash local-dev/scripts/simulate-security-scan.sh

test-report-sim:
	bash local-dev/scripts/simulate-test-reports.sh

dashboards:
	bash local-dev/scripts/start-dashboard.sh

clean:
	rm -rf local-dev/data/test-tenant-uuid-001/runs/*

localstack:
	docker compose -f local-dev/docker-compose.localstack.yml up -d

localstack-setup:
	bash local-dev/scripts/localstack-setup.sh

localstack-start:
	docker compose -f local-dev/docker-compose.localstack.yml up -d

localstack-stop:
	docker compose -f local-dev/docker-compose.localstack.yml down
