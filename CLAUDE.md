# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a full-stack Satisfactory game management application built with:

### Frontend: SvelteKit Application
- **Framework**: SvelteKit 2.x with Svelte 5.x
- **Styling**: TailwindCSS 4.x with DaisyUI components
- **Authentication**: Azure AD B2C using MSAL Browser
- **Database**: PostgreSQL with Drizzle ORM
- **Location**: `SatisfactoryManager.SvelteKit/`

### Backend: .NET Aspire AppHost
- **Framework**: .NET 9.0 with Aspire.AppHost
- **Purpose**: Orchestrates the SvelteKit app and PostgreSQL database
- **Location**: `SatisfactoryManager.AppHost/`

### Database Schema
The application manages users, games, and role-based access:
- **Users**: Basic user information (id, displayName, email)
- **Games**: Game instances that users can participate in
- **UserGames**: Many-to-many relationship with role-based permissions (Reader, Contributor, Administrator, Owner)

## Development Commands

### SvelteKit Frontend (run from `SatisfactoryManager.SvelteKit/`)
```bash
# Development
npm run dev              # Start development server (port 5173)
npm run build           # Build for production
npm run preview         # Preview production build

# Code Quality
npm run lint            # Run ESLint and Prettier checks
npm run format          # Format code with Prettier
npm run check           # Type-check with svelte-check
npm run check:watch     # Type-check in watch mode

# Database Operations
npm run db:push         # Push schema changes to database
npm run db:migrate      # Run database migrations
npm run db:studio       # Open Drizzle Studio (database GUI)
npm run generate        # Generate migration files
```

### .NET Aspire AppHost (run from `SatisfactoryManager.AppHost/`)
```bash
dotnet run              # Start the Aspire host (orchestrates all services)
dotnet build            # Build the AppHost project
```

### Docker Services (run from project root)
```bash
docker compose up -d postgres pgadmin    # Start PostgreSQL and pgAdmin
```

## Key Configuration Files

### Environment Variables
- **Database**: `DATABASE_URL` for PostgreSQL connection
- **Azure B2C**: Dual environment setup required
  - Server-side: `AZURE_B2C_CLIENT_ID`, `AZURE_B2C_AUTHORITY`, etc.
  - Client-side: `VITE_AZURE_B2C_CLIENT_ID`, `VITE_AZURE_B2C_AUTHORITY`, etc.

### Database Configuration
- **Schema**: `src/lib/server/db/schema.ts` - Drizzle schema definitions
- **Config**: `drizzle.config.ts` - Drizzle Kit configuration
- **Connection**: PostgreSQL via connection string in environment variables

### Authentication Setup
Azure AD B2C authentication is configured in `src/lib/auth/config.ts` with environment-aware variable loading for both server and client contexts.

## Directory Structure

### SvelteKit App Structure
- `src/lib/components/` - Reusable Svelte components
- `src/lib/dialogs/` - Modal dialog components with handlers
- `src/lib/server/` - Server-side code (database, services)
- `src/lib/states/` - Svelte 5 state management (`.svelte.ts` files)
- `src/routes/` - SvelteKit routes with API endpoints
- `drizzle/` - Database migration files

### Key Service Files
- `src/lib/server/services/gameService.ts` - Game management logic
- `src/lib/server/services/userService.ts` - User management logic
- `src/lib/states/authState.svelte.ts` - Authentication state management
- `src/lib/states/gameState.svelte.ts` - Game state management

## Development Notes

### Database Development
- Use `npm run db:studio` to inspect database contents
- Schema changes require running `npm run generate` then `npm run db:push`
- Migrations are stored in `drizzle/` directory
- **IMPORTANT**: Every schema modification must be documented in Notion at https://www.notion.so/d721ef6207ca4281b642d3753dbc3c75

### Authentication Flow
- Azure B2C handles user authentication
- JWT tokens are used for API authorization
- Environment variables must be duplicated with `VITE_` prefix for client-side access

### Testing Database Connection
- Local PostgreSQL: `postgres://app:app@localhost:5432/satisfactory`
- pgAdmin available at: `http://localhost:8081` (admin@example.com / admin)