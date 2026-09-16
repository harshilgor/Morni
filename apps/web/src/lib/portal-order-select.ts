/** Store portal order fields — excludes delivery_phone so owners cannot read shopper numbers. */
export const PORTAL_ORDER_COLUMNS =
  "id, order_number, shopper_id, store_id, status, payment_method, payment_status, subtotal_aed, small_order_fee_aed, delivery_fee_aed, service_fee_aed, total_aed, delivery_emirate, delivery_area, delivery_street, delivery_building, delivery_apartment, delivery_notes, delivery_eta_minutes, delivery_slot_start, delivery_slot_end, placed_at, updated_at";

export const PORTAL_ORDER_SELECT = `${PORTAL_ORDER_COLUMNS}, order_items(*)`;

export const PORTAL_ORDER_WITH_DELIVERY_SELECT =
  `${PORTAL_ORDER_COLUMNS}, order_items(*), delivery_jobs(id, status, delivery_proofs(id, storage_path, created_at))`;
