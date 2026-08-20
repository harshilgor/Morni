# Morni

UAE marketplace for local retail — browse boutiques, shop online, same-day delivery.

## Monorepo

| Path | What | Typical owner |
|---|---|---|
| `apps/web` | Shopper marketplace + store-owner portal | Marketplace team |
| `apps/delivery` | Partner dispatch + rider apps (`/partner`, `/driver`) | Delivery team |
| `apps/founder` | Founder control tower (`/founder`) | Founder/ops team |
| `apps/ios` | Native SwiftUI shopper app | Mobile team |
| `supabase` | Schema, RLS, seed migrations | Shared |

Extension apps (`delivery`, `founder`) are separate folders so teammates can work without stepping on marketplace files. They are mounted into `apps/web` via thin route re-exports until they get their own Vercel projects.

## Quick start (web)

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

- Shopper: `/`
- Auth: `/auth`
- Store portal: `/portal`
- Delivery partner: `/partner`
- Rider: `/driver`
- Founder: `/founder`

## Team workflow

1. Prefer editing files inside your owned app folder (`apps/web`, `apps/delivery`, or `apps/founder`).
2. Push to `main` (or open a PR) — Vercel deploys from `apps/web`.
3. See each app’s `README.md` for ownership boundaries.

## Supabase

Migrations live in `supabase/migrations/`. Applied to the linked project with a single seed store (Lume Boutique).

MVP checkout uses COD. `payment_method` / `payment_status` columns are ready for a gateway later.

## iOS

See `apps/ios/README.md`. Requires Mac + Xcode.

## Demo store owner

1. Sign up at `/auth` as Store owner
2. Open `/portal` and claim a demo store
3. Manage products, settings, and order status
