# Morni

### Discover UAE boutiques. Find something you love. Have it delivered the next day.

Morni is a UAE marketplace that brings independent fashion boutiques together in one place. Shoppers can explore local collections, compare products, and place an order online. Boutique teams can manage their storefronts, products, and orders through the same platform.

[Visit the Morni storefront](https://morniuae.com)

<p align="center">
  <img src="apps/web/public/hero/navratri-collection.webp" alt="A featured Navratri collection from the Morni homepage" width="760" />
</p>

<p align="center"><em>A featured collection from the Morni storefront.</em></p>

## What Morni does

- **Shop local boutiques:** Browse clothing and accessories by category, collection, and price.
- **Manage a boutique:** Store owners can maintain product listings and inventory, then keep up with incoming orders in their portal.
- **Know the delivery cost up front:** Checkout estimates driving distance from the boutique to the delivery address and shows the fee before payment. Current fees are AED 7 up to 10 km, AED 10 above 10 km through 15 km, and AED 15 above 15 km.
- **Plan for next-day delivery:** Customers choose delivery details at checkout; the Morni team contacts them to arrange a preferred time.
- **Support the team behind the marketplace:** Founder and delivery workspaces help the team follow orders and day-to-day operations.

## Inside the repository

| Folder | What it contains |
| --- | --- |
| [`apps/web`](apps/web) | Shopper marketplace, checkout, boutique portal, founder workspace, and delivery partner pages |
| [`apps/delivery`](apps/delivery) | Delivery partner and driver workflows |
| [`apps/founder`](apps/founder) | Founder and operations workspace |
| [`apps/ios`](apps/ios) | Native iOS shopper app built with SwiftUI |
| [`supabase`](supabase) | Database migrations, access policies, and seed data |

The web app is built with Next.js, React, and TypeScript. Supabase provides the database and authentication, and the web app is deployed on Vercel.

## Run the web app locally

You’ll need Node.js and npm. From the repository root:

```bash
cd apps/web
npm install
cp .env.example .env.local
# Add your development service values to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The main routes are:

| Page | Route |
| --- | --- |
| Shop | `/` |
| Sign in | `/auth` |
| Boutique portal | `/portal` |
| Delivery partner | `/partner` |
| Driver | `/driver` |
| Founder workspace | `/founder` |

For app-specific setup notes, see the [`iOS guide`](apps/ios/README.md), [`delivery guide`](apps/delivery/README.md), and [`founder guide`](apps/founder/README.md).

## Database changes

Database changes are kept as ordered SQL migrations in `supabase/migrations`. Apply migrations to a development Supabase project before testing database-dependent features. Do not apply local experiments directly to production.

## Contributing

Keep changes focused on the app you’re working in, and include relevant tests when behavior changes. See each app’s README for its setup and ownership notes.
