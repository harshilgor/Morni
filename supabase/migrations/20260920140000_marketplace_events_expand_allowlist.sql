-- Expand marketplace_events allowlist for discovery, checkout funnel, friction, auth.

alter table public.marketplace_events
  drop constraint if exists marketplace_events_name_check;

alter table public.marketplace_events
  add constraint marketplace_events_name_check check (
    event_name in (
      'product_view',
      'cart_add',
      'cart_remove',
      'cart_update',
      'checkout_start',
      'wishlist_add',
      'wishlist_remove',
      'search',
      'search_zero_results',
      'search_result_click',
      'home_view',
      'category_view',
      'collection_view',
      'store_view',
      'listing_impression',
      'listing_click',
      'checkout_address_complete',
      'checkout_slot_selected',
      'checkout_place_order',
      'checkout_payment_start',
      'checkout_payment_fail',
      'checkout_payment_success',
      'size_selected',
      'variant_selected',
      'add_to_cart_blocked',
      'pdp_related_click',
      'auth_view',
      'auth_signup_success',
      'auth_login_success',
      'auth_fail',
      'filter_apply',
      'sort_change',
      'location_set',
      'promo_click',
      'empty_cart_view',
      'wishlist_to_cart',
      'error',
      'session_start'
    )
  );
