// ═══════════════════════════════════════════════════════
// ENAYI HOTELS & SUITES — TypeScript Interfaces
// Matches Django backend models exactly
// ═══════════════════════════════════════════════════════

export type UserRole = 'guest' | 'staff' | 'manager' | 'admin'

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  phone?: string
  role: UserRole
  avatar?: string
  date_of_birth?: string
  nationality?: string
  is_verified: boolean
  date_joined: string
  loyalty_points: number
  newsletter: boolean
}

// ── Rooms ──────────────────────────────────────────────
export interface Amenity {
  id: string
  name: string
  icon: string
  category: string
  is_premium: boolean
}

export interface RoomImage {
  id: string
  image_url: string
  caption: string
  is_primary: boolean
  sort_order: number
}

export interface RoomReview {
  id: string
  guest_name: string
  rating: number
  cleanliness: number
  comfort: number
  service: number
  title: string
  body: string
  created_at: string
}

export interface RoomCategory {
  id: string
  name: string
  slug: string
  tagline: string
  description: string
  long_description: string
  base_price: number
  weekend_price: number
  holiday_price: number
  current_price: string
  max_adults: number
  max_children: number
  bed_type: string
  num_beds: number
  room_size_sqm: number
  num_bathrooms: number
  has_living_room: boolean
  has_kitchen: boolean
  has_balcony: boolean
  amenities: Amenity[]
  images: RoomImage[]
  avg_rating?: number
  available_rooms: number
  sort_order: number
}

export interface Room {
  id: string
  room_number: string
  category: string
  category_name: string
  floor: number
  status: 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'reserved' | 'out_of_order'
  is_smoking: boolean
  has_balcony: boolean
  view_type: string
  current_price: string
}

// ── Bookings ────────────────────────────────────────────
export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'

export interface BookingRoomDetail {
  id: string
  room_number: string
  category_name: string
  floor: number
  view_type: string
}

export interface Booking {
  id: string
  booking_reference: string
  guest: string
  guest_name: string
  room: string
  room_detail?: BookingRoomDetail
  check_in: string
  check_out: string
  actual_check_in?: string
  actual_check_out?: string
  adults: number
  children: number
  status: BookingStatus
  source: string
  room_rate_per_night: number
  total_nights: number
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  amount_paid: number
  balance_due: number
  is_fully_paid: boolean
  special_requests: string
  breakfast_included: boolean
  airport_pickup: boolean
  late_checkout: boolean
  early_checkin: boolean
  cancellation_reason?: string
  cancelled_at?: string
  created_at: string
  updated_at: string
}

// ── Orders ──────────────────────────────────────────────
export interface MenuCategory {
  id: string
  name: string
  type: 'food' | 'drink' | 'cocktail' | 'mocktail' | 'wine' | 'dessert' | 'breakfast' | 'snack'
  icon: string
  description: string
  is_active: boolean
  sort_order: number
}

export interface MenuItem {
  id: string
  category: string
  category_name: string
  category_type: string
  name: string
  description: string
  price: number
  image_url?: string
  is_available: boolean
  is_vegetarian: boolean
  is_vegan: boolean
  is_halal: boolean
  is_gluten_free: boolean
  is_spicy: boolean
  allergens: string
  calories?: number
  preparation_time: number
  sort_order: number
}

export interface OrderItem {
  id: string
  menu_item: string
  menu_item_name: string
  menu_item_price: number
  quantity: number
  unit_price: number
  total_price: number
  customizations: string
  is_ready: boolean
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
export type OrderSource = 'kitchen' | 'bar' | 'room_service' | 'restaurant' | 'poolside' | 'event'

export interface Order {
  id: string
  order_number: string
  guest: string
  guest_name: string
  room?: string
  room_number?: string
  source: OrderSource
  status: OrderStatus
  items: OrderItem[]
  special_instructions: string
  subtotal: number
  delivery_charge: number
  tax: number
  total_amount: number
  is_paid: boolean
  estimated_delivery?: string
  delivered_at?: string
  created_at: string
  updated_at: string
}

// ── Cart ────────────────────────────────────────────────
export interface CartItem {
  menu_item: MenuItem
  quantity: number
  customizations: string
}

// ── Events ──────────────────────────────────────────────
export interface EventHallImage {
  id: string
  image_url: string
  caption: string
  is_primary: boolean
}

export interface EventHall {
  id: string
  name: string
  slug: string
  description: string
  capacity_seated: number
  capacity_cocktail: number
  capacity_banquet: number
  size_sqm: number
  floor: number
  price_per_hour: number
  price_half_day: number
  price_full_day: number
  price_weekend: number
  deposit_percent: number
  has_projector: boolean
  has_sound_system: boolean
  has_microphone: boolean
  has_wifi: boolean
  has_ac: boolean
  has_stage: boolean
  has_dance_floor: boolean
  has_parking: boolean
  images: EventHallImage[]
}

export type EventStatus = 'pending' | 'confirmed' | 'deposit_paid' | 'fully_paid' | 'completed' | 'cancelled'

export interface EventBooking {
  id: string
  booking_reference: string
  organizer: string
  organizer_name: string
  hall: string
  hall_name: string
  event_name: string
  event_type: string
  event_date: string
  start_time: string
  end_time: string
  setup_time: string
  expected_guests: number
  setup_style: string
  catering_required: boolean
  decoration_required: boolean
  photography_required: boolean
  mc_required: boolean
  live_band_required: boolean
  dj_required: boolean
  special_requests: string
  contact_phone: string
  contact_email: string
  hall_rate: number
  extras_cost: number
  catering_cost: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  deposit_amount: number
  amount_paid: number
  balance_due: number
  status: EventStatus
  created_at: string
}

// ── Payments ────────────────────────────────────────────
export type PaymentMethod = 'flutterwave' | 'paystack' | 'stripe' | 'paypal' | 'ussd' | 'bank_transfer' | 'cash' | 'pos'
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded' | 'abandoned'

export interface Payment {
  id: string
  transaction_reference: string
  purpose: string
  method: PaymentMethod
  gateway: string
  amount: number
  currency: string
  status: PaymentStatus
  narration: string
  flw_ref?: string
  paystack_ref?: string
  access_code?: string
  stripe_session_id?: string
  paypal_order_id?: string
  ussd_code?: string
  ussd_bank?: string
  virtual_acct_num?: string
  virtual_acct_bk?: string
  verified_at?: string
  created_at: string
}

export interface PaymentInitResponse {
  success:               boolean
  gateway:               string
  transaction_reference: string
  payment_id:            string
  payment_link?:         string

  // Paystack
  access_code?:          string

  // Stripe
  session_id?:           string

  // Monnify
  monnify_ref?:          string

  // USSD
  ussd_code?:            string
  bank_name?:            string
  instructions?:         string[]
  expires_at?:           string
  expires_in_minutes?:   number

  // Bank Transfer  ← these were missing
  account_number?:       string
  account_name?:         string
  sort_code?:            string
  bank_code?:            string
  amount?:               string
  narration?:            string
  also_accepted?:        { bank: string; account: string; name: string }[]
  important?:            string

  // Cash / POS
  message?:              string
  front_desk?:           string
  phone?:                string

  error?:                string
}

// ── Gallery ─────────────────────────────────────────────
export interface GalleryCategory {
  id: string
  name: string
  slug: string
  category_type: string
  description: string
  image_count: number
}

export interface GalleryImage {
  id: string
  category: string
  category_name: string
  category_type: string
  title: string
  description: string
  image_url: string
  alt_text: string
  is_featured: boolean
  width?: number
  height?: number
  uploaded_at: string
}

// ── AI Chat ─────────────────────────────────────────────
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ChatSession {
  session_id: string
  title: string
  message_count: number
  updated_at: string
}

// ── Dashboard ───────────────────────────────────────────
export interface DashboardStats {
  rooms: {
    total: number
    occupied: number
    available: number
    maintenance: number
    occupancy_rate: number
  }
  bookings: {
    today_checkins: number
    today_checkouts: number
    active_guests: number
    pending: number
    this_month: number
    last_month: number
  }
  revenue: {
    today: number
    this_month: number
    last_month: number
    total: number
    growth_pct: number
  }
  orders: { pending: number; this_month: number }
  events: { upcoming: number }
  guests: { total: number; new_this_month: number }
}

// ── API helpers ─────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number
  next?: string
  previous?: string
  results: T[]
}

export interface ApiError {
  error?: string
  detail?: string
  message?: string
  [key: string]: unknown
}
