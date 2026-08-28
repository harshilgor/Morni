-- One-time reset of test order data. Keep stores, products, accounts, and
-- configuration intact so the marketplace can start with a clean order queue.
delete from public.delivery_proofs;
delete from public.delivery_handoffs;
delete from public.delivery_events;
delete from public.delivery_assignments;
delete from public.delivery_jobs;
delete from public.order_payments;
delete from public.product_reviews;
delete from public.orders;
