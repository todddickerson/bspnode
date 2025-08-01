# BSPNode Test Suite

This directory contains comprehensive tests for the multi-host streaming functionality.

## Test Structure

- `multi-host.spec.ts` - Basic multi-host functionality tests
- `multi-host-advanced.spec.ts` - Advanced scenarios including network issues and stress tests
- `multi-host-errors.spec.ts` - Error handling and recovery tests
- `multi-host-performance.spec.ts` - Performance benchmarks and measurements
- `api-multi-host.spec.ts` - API endpoint tests
- `multi-host-test-plan.md` - Manual test plan documentation

## Prerequisites

1. **Database Setup**: Ensure PostgreSQL is running and accessible
2. **Environment**: Copy `.env.example` to `.env.local` and configure
3. **Test Users**: Create test users in the database

## Running Tests

### Setup Test Users
```bash
npm run test:setup
```

This creates the following test users:
- `test-owner@example.com` - Stream Owner
- `test-host1@example.com` - Host One
- `test-host2@example.com` - Host Two  
- `test-host3@example.com` - Host Three
- `test-unauthorized@example.com` - Unauthorized User

All test users have password: `test123456`

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Basic multi-host tests
npm run test:multi-host

# Advanced scenarios
npm run test:advanced

# Error handling tests
npm run test:errors

# Performance tests
npm run test:performance

# API tests
npm run test:api
```

### Interactive Test UI
```bash
npm run test:ui
```

## Test Configuration

Tests run in headless mode by default. To run in headed mode:
1. Edit `playwright.config.ts`
2. Change `headless: true` to `headless: false`

## CI/CD

Tests automatically run on:
- Push to `main` or `develop` branches
- Pull requests

GitHub Actions workflow is configured in `.github/workflows/playwright.yml`

## Writing New Tests

1. Create a new `.spec.ts` file in the `tests` directory
2. Import necessary helpers from existing tests
3. Use the test user accounts defined above
4. Follow the existing patterns for:
   - Login flow
   - Stream creation
   - Multi-context testing

## Debugging Failed Tests

1. **Screenshots**: Available in `test-results/` on failure
2. **Videos**: Recorded for failed tests (if configured)
3. **Traces**: Can be viewed with Playwright trace viewer
4. **Logs**: Check console output for performance metrics

## Performance Benchmarks

Current performance targets:
- Studio load time: < 10 seconds
- Video connection: < 15 seconds
- Join time: < 10 seconds per host
- Chat latency: < 2 seconds
- Reconnection: < 30 seconds

## Known Issues

- Some tests require actual camera/microphone access
- Network simulation tests may be flaky on CI
- Performance tests are dependent on system resources