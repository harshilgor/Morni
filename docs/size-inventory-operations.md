# Size inventory operations

## Source of truth

For new products, `products.size_stock` is the source of truth. It maps the exact
size label to the available quantity, for example `{ "S": 1, "M": 3, "L": 0 }`.
`products.stock` remains an aggregate compatibility value and is maintained by a
database trigger.

## Bulk upload contract

The photo bulk-upload flow sends `sizeStock` alongside `sizes` for every product.
The server validates non-negative integer quantities and persists the mapping in
`bulk_import_items.size_stock` before publishing.

## Restoration rules

- Checkout locks the product row and atomically decrements the selected size.
- Customer/store cancellation restores the exact size and creates a pending
  owner notification.
- Failed delivery transitions restore the exact size through a database trigger.
- Accepting a restoration keeps the quantity. Rejecting it atomically retracts
  the restored quantity; if it has already sold, the owner must resolve it
  manually rather than risking negative stock.
- Return/refund restoration must call the same restoration primitive after a
  return is approved. This repository currently has refund quoting UI but no
  return approval/write flow, so it is intentionally not auto-restored yet.

## Legacy products

Products with sizes and an empty `size_stock` mapping receive a portal
notification. No quantities are guessed or split. Opening “Set size quantities”
opens the product editor, where the owner can enter each size quantity; saving
the product resolves the legacy notification.

## Bulk data example

```json
{
  "title": "Linen shirt",
  "sizes": ["S", "M", "L"],
  "sizeStock": { "S": 1, "M": 3, "L": 0 }
}
```
