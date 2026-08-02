export type UserRole = "shopper" | "store_owner" | "admin";
export type OrderStatus =
  | "placed"
  | "accepted"
  | "picking"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";
export type PaymentMethod = "cod" | "card" | "apple_pay" | "tabby" | "tamara";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type UaeEmirate =
  | "dubai"
  | "abu_dhabi"
  | "sharjah"
  | "ajman"
  | "uaq"
  | "rak"
  | "fujairah";

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
};

export type Store = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emirate: UaeEmirate;
  area: string;
  address: string;
  lat: number | null;
  lng: number | null;
  logo_url: string | null;
  cover_url: string | null;
  is_active: boolean;
  delivery_eta_minutes: number;
  opens_at: string | null;
  closes_at: string | null;
};

export type Product = {
  id: string;
  store_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  price_aed: number;
  compare_at_price_aed: number | null;
  image_urls: string[];
  stock: number;
  is_available: boolean;
};

export type Order = {
  id: string;
  order_number: string;
  shopper_id: string;
  store_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal_aed: number;
  delivery_fee_aed: number;
  total_aed: number;
  delivery_emirate: UaeEmirate;
  delivery_area: string;
  delivery_street: string;
  delivery_building: string | null;
  delivery_apartment: string | null;
  delivery_notes: string | null;
  delivery_eta_minutes: number;
  placed_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  title: string;
  unit_price_aed: number;
  quantity: number;
  line_total_aed: number;
};
