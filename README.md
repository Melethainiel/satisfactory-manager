# Satisfactory Manager

Full-stack application for managing Satisfactory game instances with SvelteKit frontend and PostgreSQL database.

## 🚀 Quick Start (Docker Compose)

### Development Mode
Start development environment with hot-reload:

```bash
docker compose up -d postgres app-dev
```

Access the application at **http://localhost:5173**

### Database Only
Start only PostgreSQL and pgAdmin:

```bash
docker compose up -d postgres pgadmin
```

Access pgAdmin at **http://localhost:8081** (admin@example.com / admin)

### Test Database
Start test database for running tests:

```bash
docker compose up -d postgres-test
```

## 📦 Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Main database |
| PostgreSQL (test) | 5433 | Test database (not persisted) |
| pgAdmin | 8081 | Database management UI |
| SvelteKit Dev | 5173 | Development server with hot reload |

## 🔧 Connection Strings

```
Development: postgres://app:app@localhost:5432/satisfactory
Testing:     postgres://app:app@localhost:5433/satisfactory_test
```

## 📁 Project Structure

```
.
├── SatisfactoryManager.SvelteKit/   # SvelteKit frontend application
├── docker-compose.yml               # Docker services configuration
└── README.md                       # This file
```

## 🛠️ Development Commands

### Local Development (without Docker)

```bash
cd SatisfactoryManager.SvelteKit
npm install
npm run dev                          # Start dev server on http://localhost:5173
```

### Database Operations

```bash
cd SatisfactoryManager.SvelteKit
npm run db:push                      # Push schema changes to database
npm run db:migrate                   # Run database migrations
npm run db:studio                    # Open Drizzle Studio (database GUI)
```

### Code Quality

```bash
npm run lint                         # Run ESLint and Prettier checks
npm run format                       # Format code with Prettier
npm run check                        # Type-check with svelte-check
```

### Testing

```bash
npm run test                         # Run tests in watch mode
npm run test:run                     # Run tests once
npm run test:coverage                # Run tests with coverage
```

## 🐳 Docker Commands

```bash
# Start services
docker compose up -d postgres app-dev

# View logs
docker compose logs -f app-dev

# Stop services
docker compose down

# Stop services and remove volumes
docker compose down -v

# Rebuild app
docker compose up -d --build app-dev
```

## 📝 Environment Variables

Copy `.env.example` to `.env.local` and configure:

```env
DATABASE_URL=postgres://app:app@localhost:5432/satisfactory
```

## 🔐 Authentication

Currently using Azure AD B2C (planning migration to Better Auth).

## 🗄️ Database Schema

- **users**: User accounts
- **games**: Game instances
- **user_games**: User-game relationships with roles
- **sites**: Sites within games
- **modules**: Game modules (mods)
- And more... see `src/lib/server/db/schema.ts`

## 🚢 Deployment

### Coolify (Production)

Deploy to Coolify:
1. Push code to Git repository
2. Connect repository in Coolify
3. Create new service with **Nixpacks** (auto-detects Node.js/SvelteKit)
4. Configure environment variables:
   - `DATABASE_URL`: PostgreSQL connection string
   - `AUTH_SECRET`: Secret for Better Auth
   - `AUTH_URL`: Your Coolify domain
   - `PUBLIC_AUTH_URL`: Your Coolify domain
   - Azure B2C credentials (if using OIDC provider)
5. Deploy

## 📚 Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed architecture and development guidelines.

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request
