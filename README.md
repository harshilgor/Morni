# Morni

UAE marketplace for local retail — browse boutiques, shop online, delivery within ~1 hour.

## Monorepo

| Path | What |
|---|---|
| `apps/web` | Next.js shopper site + store-owner portal |
| `apps/ios` | Native SwiftUI shopper app |
| `supabase` | Schema, RLS, seed migrations |

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

## Supabase

Migrations live in `supabase/migrations/`. Applied to the linked project with seed stores (Lume Boutique, Sand & Silk, Noor Atelier).

MVP checkout uses COD. `payment_method` / `payment_status` columns are ready for a gateway later.

## iOS

See `apps/ios/README.md`. Requires Mac + Xcode.

## Demo store owner

1. Sign up at `/auth` as Store owner
2. Open `/portal` and claim a demo store
3. Manage products, settings, and order status
