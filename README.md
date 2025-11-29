This repository hosts the Tally MVP frontend built with [Next.js](https://nextjs.org).

## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the default page. Edit `app/page.tsx` to start building the UI.

## Supabase Configuration

Create an `.env.local` file with the publishable credentials for the Tally Supabase project:

```
NEXT_PUBLIC_SUPABASE_URL=https://jqixmhtgpabvaqdegvdn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

The anon key (see Supabase dashboard) is safe to use in the browser. `lib/supabaseClient.ts` exposes helpers for browser/server clients, and `ClientsPreview` + `useClients` demonstrate querying the `clients` table directly from the dashboard page.

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

`scripts/migrations/0002_rls_policies.sql` enables row-level security and enforces organisation scoping via the `current_user_org_id()` helper. Run it after the base schema so all tables are protected.

Smoke checks:

- `scripts/tests/schema_smoke_test.sql` – validates table creation.
- `scripts/tests/rls_isolation_test.sql` – seeds two organisations, impersonates each user via `request.jwt.claim.sub`, and demonstrates that cross-org reads are blocked before rolling back.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) – features, API, and guides.
- [Learn Next.js](https://nextjs.org/learn) – interactive tutorial.

## Deploy on Vercel

The easiest way to deploy the app is via [Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme). See the [deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for alternatives.
