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

export type DeliveryAddress = {
  id: string;
  user_id: string;
  label: string;
  phone: string | null;
  emirate: UaeEmirate;
  area: string;
  street: string;
  building: string | null;
  apartment: string | null;
  notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
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
  size_chart_url?: string | null;
  is_active: boolean;
  delivery_eta_minutes: number;
  opens_at: string | null;
  closes_at: string | null;
  pause_note?: string | null;
  onboarding_step: number;
  onboarding_completed_at: string | null;
  created_at?: string;
};

export type StorePickupLocation = {
  store_id: string;
  emirate: UaeEmirate;
  area: string;
  address: string;
  lat: number | null;
  lng: number | null;
  is_public: boolean;
};

export type Product = {
  id: string;
  store_id: string;
  category_id: string | null;
  category?: { name?: string | null; slug?: string | null } | null;
  title: string;
  product_tag?: string | null;
  fabric?: string | null;
  description: string | null;
  price_aed: number;
  compare_at_price_aed: number | null;
  image_urls: string[];
  sizes: string[];
  size_stock?: Record<string, number> | null;
  stock: number;
  is_available: boolean;
  customization_enabled?: boolean;
  customization_instructions?: string | null;
  customization_fields?: import("@/lib/product-customization").ProductCustomizationField[];
};

export type ProductVariant = {
  id: string;
  product_id: string;
  color_name: string;
  color_hex: string | null;
  image_urls: string[];
  sizes: string[];
  stock: number;
  sort_order: number;
};

export type StoreCampaign = {
  id: string;
  title: string;
  description: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
};

export type RelatedProduct = Product & {
  stores: { slug: string; name: string };
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
  small_order_fee_aed: number;
  delivery_fee_aed: number;
  service_fee_aed: number;
  total_aed: number;
  delivery_emirate: UaeEmirate;
  delivery_area: string;
  delivery_street: string;
  delivery_phone: string | null;
  delivery_building: string | null;
  delivery_apartment: string | null;
  delivery_notes: string | null;
  delivery_eta_minutes: number;
  delivery_slot_start: string | null;
  delivery_slot_end: string | null;
  placed_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id?: string | null;
  title: string;
  size: string | null;
  color_name?: string | null;
  unit_price_aed: number;
  quantity: number;
  line_total_aed: number;
  image_url?: string | null;
  customization?: import("@/lib/product-customization").ProductCustomizationValues | null;
};

export type ProductReview = {
  id: string;
  product_id: string;
  store_id: string;
  shopper_id: string;
  order_id: string;
  order_item_id: string | null;
  rating: number;
  body: string | null;
  shopper_name: string;
  owner_reply: string | null;
  owner_replied_at: string | null;
  created_at: string;
  updated_at: string;
};
