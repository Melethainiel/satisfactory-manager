# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Database (PostgreSQL) - Local Development

This project uses PostgreSQL via Drizzle ORM. A `docker-compose.yml` file at the repository root provides a ready-to-use local database (Postgres `latest`) plus pgAdmin.

Start the database (and pgAdmin UI):

```bash
docker compose up -d postgres pgadmin
```

Connection string (already set in `.env.local` and `.env.example`):

```
postgres://app:app@localhost:5432/satisfactory
```

Run migrations (after installing dependencies):

```bash
npx drizzle-kit migrate
```

Optional: Generate SQL migration files:

```bash
npx drizzle-kit generate
```

Access pgAdmin: http://localhost:8081 (login: admin@example.com / admin). Add a new server in pgAdmin with host `postgres`, user `app`, password `app`.

Stop and remove the containers:

```bash
docker compose down
```

Remove volumes (DESTROYS DATA):

```bash
docker compose down -v
```
