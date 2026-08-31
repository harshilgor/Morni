# Returns and reverse logistics task list

## Delivered in this release

- [x] Shopper return request with per-order-item quantities, reason, note, and refund method.
- [x] Fourteen-day eligibility window and duplicate/over-return validation inside a locked database function.
- [x] Store-owner review desk on the desktop and mobile overview pages.
- [x] Approval creates a reverse pickup job assigned to the original delivery driver; no automatic reassignment to another driver.
- [x] Driver portal return card with customer navigation, accept, arrived, collected, and arrived-at-store steps.
- [x] Shopper return status messaging on the order detail page.
- [x] Store receipt confirmation before inventory restoration.
- [x] Exact size-level inventory restoration when historical size stock exists.
- [x] Safe fallback for legacy products: restore aggregate stock and create a size-review notification rather than guessing a size split.
- [x] Idempotent inventory-adjustment ledger and refund record.
- [x] Owner refund-processing confirmation with processor reference.
- [x] Return events and row-level access policies for shopper, owner, and assigned driver.

## Deliberate operational boundary

The application now records a refund that is ready for processing and lets the owner record the payment processor reference. It does not pretend that a card refund happened when no payment-provider refund API is configured. Connecting that final mutation to the provider webhook is the next deployment-specific step.

## Verification checklist

- Shopper cannot request a return before delivery or after the return window.
- Shopper cannot return more units than were purchased, including across multiple requests.
- Store owner cannot review another store's request.
- Driver cannot see or mutate a return assigned to another driver.
- Approval fails rather than silently assigning a different driver when the original driver is missing.
- Repeated receive/refund actions do not duplicate inventory or refund rows.
- Size-level returns update only the matching size and the aggregate product stock.
