# Morni Delivery

Partner dispatch (`/partner`) and rider (`/driver`) UI.

## Ownership

Edit files here for delivery work. Keep marketplace changes in `apps/web`.

| Path | What |
|---|---|
| `src/components/delivery-workspaces.tsx` | Partner dispatch dashboard |
| `src/components/delivery-invite-join.tsx` | Invite accept flow |
| `src/components/driver/driver-workspace.tsx` | Rider job workspace |

Route shells live in `apps/web/src/app/(delivery)/` and import these components so URLs stay on the main Vercel project.

## Related APIs (in web, delivery-owned)

- `apps/web/src/app/api/delivery/**`
- `apps/web/src/app/api/cron/delivery-dispatch/**`
- `apps/web/src/app/api/orders/[orderId]/ready-for-pickup/**`

## Local check

```bash
cd apps/web
npm install
npm run dev
```

Open `/partner` or `/driver`.
