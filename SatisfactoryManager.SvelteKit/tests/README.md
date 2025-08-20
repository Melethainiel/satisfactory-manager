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

### 🐳 Docker Setup (Recommended)

The easiest way to run tests is using Docker, which automatically manages the test database:

```bash
# Run tests with automatic Docker database management
npm run test:docker

# Or step by step:
npm run test:docker:setup    # Start test database
npm run test:run            # Run tests
npm run test:docker:cleanup # Stop test database
```

**Docker Commands:**

```bash
# Start test database only
docker compose up -d postgres-test

# Check database status
docker compose ps postgres-test

# View database logs
npm run test:docker:logs

# Stop test database
npm run test:docker:cleanup

# Remove test database completely
npm run test:docker:down
```

### 🛠️ Manual Setup (Alternative)

If you prefer manual database setup:

1. **Test Database**: Set up a separate PostgreSQL database:

   ```bash
   # Create test database manually
   createdb satisfactory_test

   # Or set custom test database URL
   export TEST_DATABASE_URL="postgres://user:pass@localhost:5432/your_test_db"
   ```

2. **Environment Variables**: The `.env.test` file is automatically loaded during tests.

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

### 🐳 Docker Database (postgres-test)

- **Port**: 5433 (different from main database on 5432)
- **Database**: `satisfactory_test`
- **User/Password**: `app/app`
- **Connection**: `postgres://app:app@localhost:5433/satisfactory_test`
- **Storage**: In-memory (tmpfs) for faster tests
- **Memory**: Limited to 256MB for efficiency

### ⚙️ Automatic Configuration

1. **Schema migrations** - Automatically applies latest schema on startup
2. **Data cleanup** - Clears all data between tests for isolation
3. **Connection retry** - Handles Docker container startup delays
4. **Health checks** - Ensures database is ready before running tests

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

## 🧰 Helper Scripts

### Database Management Script

Use the comprehensive database management script for advanced operations:

```bash
# Make script executable (if needed)
chmod +x scripts/test-db.sh

# Available commands
./scripts/test-db.sh start     # Start test database
./scripts/test-db.sh stop      # Stop test database
./scripts/test-db.sh reset     # Reset database (fresh start)
./scripts/test-db.sh status    # Check database status
./scripts/test-db.sh logs      # View database logs
./scripts/test-db.sh shell     # Open database shell (psql)
./scripts/test-db.sh test      # Run tests with auto-management
./scripts/test-db.sh help      # Show help
```

### Advanced Usage

```bash
# Run tests but keep database running for debugging
TEST_CLEANUP=false ./scripts/test-db.sh test

# Open database shell for inspection
./scripts/test-db.sh shell
# Inside psql:
# \dt                          # List tables
# SELECT * FROM users;         # Query users table
# \q                          # Exit psql
```

## Troubleshooting

### 🐳 Docker Issues

```bash
# Check if Docker is running
docker info

# Check test database container
docker compose ps postgres-test

# View container logs
docker compose logs postgres-test

# Restart test database
docker compose restart postgres-test

# Force recreate test database
docker compose down postgres-test && docker compose up -d postgres-test
```

### 🔌 Connection Issues

```bash
# Test manual connection
docker exec -it satisfactory-postgres-test psql -U app -d satisfactory_test

# Check port availability
lsof -i :5433

# Verify test database URL
node -e "console.log(process.env.TEST_DATABASE_URL || 'Not set')"
```

### 🚀 Performance Issues

```bash
# Monitor database during tests
docker stats satisfactory-postgres-test

# Check if tmpfs is being used
docker inspect satisfactory-postgres-test | grep -i tmpfs
```

### 🧹 Cleanup Issues

```bash
# Clean up everything
docker compose down postgres-test
docker system prune -f

# Reset npm scripts
npm run test:docker:down
npm run test:docker:setup
```

### 💾 Migration Issues

```bash
# Check migration status inside container
docker exec -it satisfactory-postgres-test psql -U app -d satisfactory_test -c "SELECT * FROM __drizzle_migrations;"

# Manual migration (if needed)
npm run generate && npm run db:push
```
