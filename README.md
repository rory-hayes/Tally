This repository hosts the Tally MVP frontend built with [Next.js](https://nextjs.org).

## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the default page. Edit `app/page.tsx` to start building the UI.

## Testing & CI

Unit and component smoke tests use Vitest + React Testing Library:

```bash
npm run test        # one-off run
npm run test:watch  # watch mode during development
```

A GitHub Actions workflow (`.github/workflows/test.yml`) runs `npm test` on pushes and pull requests targeting `main`, so the latest commit stays green.

## Database Schema

Initial Supabase tables live in `scripts/migrations/0001_initial_schema.sql`. Apply them with the Supabase CLI or `psql`:

```bash
psql "$SUPABASE_DB_URL" -f scripts/migrations/0001_initial_schema.sql
```

`scripts/tests/schema_smoke_test.sql` performs a lightweight sanity check (table existence + counts) once the schema is in place.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) – features, API, and guides.
- [Learn Next.js](https://nextjs.org/learn) – interactive tutorial.

## Deploy on Vercel

The easiest way to deploy the app is via [Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme). See the [deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for alternatives.
