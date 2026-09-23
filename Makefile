.PHONY: help dev build lint type-check test-unit test-smoke storybook contracts-check contracts-import

help:
	@echo "Available commands for aquila-blog-web:"
	@echo "  make dev              - Start Next.js development server"
	@echo "  make build            - Run production build"
	@echo "  make lint             - Run Next.js linting"
	@echo "  make type-check       - Run TypeScript type checking"
	@echo "  make test-unit        - Run Playwright unit tests"
	@echo "  make test-smoke       - Run Playwright smoke E2E tests"
	@echo "  make storybook        - Start Storybook dev server"
	@echo "  make contracts-check  - Verify platform contracts and OpenAPI types"
	@echo "  make contracts-import - Import latest platform contracts from local aquila-blog"

dev:
	yarn dev

build:
	yarn build

lint:
	yarn lint

type-check:
	yarn type-check

test-unit:
	yarn test:unit

test-smoke:
	yarn test:e2e:smoke

storybook:
	yarn storybook

contracts-check:
	yarn contracts:check

contracts-import:
	yarn contracts:import:local
