# API Tests

This directory contains comprehensive integration tests for all API endpoints in the Satisfactory Manager application.

## Test Structure

```
tests/
├── integration/
│   ├── api/
│   │   ├── users.test.ts        # Users API tests
│   │   ├── games.test.ts        # Games API tests  
│   │   ├── items.test.ts        # Items API tests
│   │   ├── recipes.test.ts      # Recipes API tests
│   │   ├── buildings.test.ts    # Buildings API tests
│   │   ├── modules.test.ts      # Modules API tests
│   │   └── auth.test.ts         # Authentication API tests
│   └── setup/
│       ├── test-db.ts           # Test database configuration
│       ├── test-setup.ts        # Test setup and teardown
│       └── fixtures.ts          # Test data fixtures
└── README.md                    # This file
```

## Running Tests

### Prerequisites

1. **Test Database**: Set up a separate PostgreSQL database for testing:
   ```bash
   # Create test database
   createdb satisfactory_test
   
   # Or set custom test database URL
   export TEST_DATABASE_URL="postgres://user:pass@localhost:5432/your_test_db"
   ```

2. **Environment Variables**: Copy your `.env` file and update database URL for testing.

### Test Commands

```bash
# Run all tests
npm run test

# Run tests once (CI mode)
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test users.test.ts

# Run tests in watch mode
npm run test --watch
```

## Test Coverage

The test suite covers **24+ API endpoints** across 7 main resources:

### Users API (`/api/users`)
- ✅ GET - List all users
- ✅ POST - Create new user
- ✅ GET /:id - Get user by ID
- ✅ PUT /:id - Update user
- ✅ DELETE /:id - Delete user

### Games API (`/api/games`)
- ✅ GET - List games by user email
- ✅ POST - Create new game
- ✅ GET /:id - Get game by ID
- ✅ PUT /:id - Update game
- ✅ DELETE /:id - Delete game
- ✅ GET /:id/users - List game users
- ✅ POST /:id/users - Add user to game
- ✅ DELETE /:id/users - Remove user from game

### Items API (`/api/items`)
- ✅ GET - List items (with form filtering)
- ✅ POST - Create new item
- ✅ GET /:id - Get item by ID
- ✅ PUT /:id - Update item
- ✅ DELETE /:id - Delete item
- ✅ POST /import - Bulk import items

### Recipes API (`/api/recipes`)
- ✅ GET - List recipes (with search)
- ✅ POST - Create new recipe
- ✅ GET /:id - Get recipe by ID
- ✅ PUT /:id - Update recipe
- ✅ DELETE /:id - Delete recipe
- ✅ POST /import - Bulk import recipes

### Buildings API (`/api/buildings`)
- ✅ GET - List buildings (with search)
- ✅ POST - Create new building
- ✅ GET /:id - Get building by ID
- ✅ PUT /:id - Update building
- ✅ DELETE /:id - Delete building
- ✅ POST /import - Bulk import buildings

### Modules API (`/api/modules`)
- ✅ GET - List modules (with search)
- ✅ POST - Create new module
- ✅ GET /github-preview - Preview GitHub repo

### Auth API (`/api/auth`)
- ✅ POST /ensure-user - Create or update user

## Test Features

### Database Isolation
- Each test runs with a clean database state
- Automatic setup and teardown
- Transaction-based isolation (planned)

### Comprehensive Coverage
- **Happy path scenarios** (200/201 responses)
- **Validation errors** (400 responses)  
- **Not found scenarios** (404 responses)
- **Conflict scenarios** (409 responses)
- **Server error handling** (500 responses)

### Import Testing
- Bulk data import validation
- Payload size limits
- Data validation and error reporting
- Module version dependencies

### Fixtures and Utilities
- Reusable test data
- Database seeding utilities
- Helper functions for common operations

## Test Database Configuration

The test database is automatically configured with:

1. **Separate database** - Uses `satisfactory_test` or custom `TEST_DATABASE_URL`
2. **Schema migrations** - Automatically applies latest schema
3. **Data cleanup** - Clears data between tests
4. **Connection pooling** - Single connection for performance

## Error Handling

Tests verify proper error handling for:
- Missing required fields
- Invalid data formats
- Database constraint violations
- Authorization failures
- Network/server errors

## Performance Considerations

- Tests use single database connection pool
- Parallel test execution disabled for database isolation
- Fast test execution with minimal overhead
- Efficient cleanup between tests

## Contributing

When adding new API endpoints:

1. Create test file in `tests/integration/api/`
2. Add test data to `fixtures.ts`
3. Follow existing test patterns
4. Include error cases and edge cases
5. Update this README with new coverage

## Troubleshooting

### Database Connection Issues
```bash
# Check database exists
psql -l | grep satisfactory_test

# Create missing test database  
createdb satisfactory_test
```

### Migration Issues
```bash
# Reset test database
dropdb satisfactory_test && createdb satisfactory_test
npm run test
```

### Environment Issues
```bash
# Verify environment variables
echo $TEST_DATABASE_URL
echo $DATABASE_URL
```