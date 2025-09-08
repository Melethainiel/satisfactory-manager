# Testing Strategy

This document outlines the comprehensive testing strategy for the Satisfactory Manager application.

## Test Types

1. **Unit Tests** - Vitest (`tests/unit/`)
2. **Component Tests** - Vitest + Svelte Testing Library (`tests/components/`)
3. **Integration Tests** - Vitest (`tests/integration/`)
4. **E2E Tests** - Playwright (`tests/e2e/`)
5. **Accessibility Tests** - Playwright + axe-core (`tests/e2e/accessibility/`)

## Quick Commands

```bash
npm test                    # Unit/component tests
npm run test:e2e           # E2E tests
npm run test:all           # All tests
```
