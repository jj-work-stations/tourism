export type UUID = string;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface DestinationBrief {
  id: UUID;
  slug: string;
  name: string;
  name_local?: string | null;
  country?: string;
  image_url?: string | null;
}

export interface Destination extends DestinationBrief {
  country: string;
  country_code: string;
  region: string;
  description: string;
  short_description: string;
  gallery: string[];
  latitude: number;
  longitude: number;
  timezone: string;
  is_featured: boolean;
  popularity: number;
  tags: string[];
  best_season?: string | null;
  avg_daily_budget?: number | null;
  attraction_count: number;
  accommodation_count: number;
  restaurant_count: number;
  experience_count: number;
  starting_price?: number | null;
}

export interface Campaign {
  id: UUID;
  title: string;
  subtitle?: string | null;
  image_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  badge?: string | null;
  placement: string;
  sort_order: number;
}

export interface Attraction {
  id: UUID;
  slug: string;
  name: string;
  destination_id: UUID;
  destination_name: string;
  category: string;
  description: string;
  image_url?: string | null;
  gallery: string[];
  latitude: number;
  longitude: number;
  address?: string | null;
  opening_hours?: Record<string, string> | null;
  ticket_price: number;
  rating: number;
  review_count: number;
  suggested_visit_minutes: number;
  is_featured: boolean;
}

export interface Restaurant {
  id: UUID;
  slug: string;
  name: string;
  destination_id: UUID;
  destination_name?: string | null;
  description: string;
  image_url: string;
  cuisine: string;
  price_range: number;
  average_price: number;
  rating: number;
  review_count: number;
  address: string;
  latitude: number;
  longitude: number;
  opening_hours: Record<string, unknown>;
  menu: Record<string, unknown>[];
  signature_dishes: string[];
  reservation_enabled: boolean;
  is_featured: boolean;
}

export interface Experience {
  id: UUID;
  slug: string;
  name: string;
  destination_id: UUID;
  destination_name: string;
  category: string;
  description: string;
  image_url?: string | null;
  gallery: string[];
  duration_minutes: number;
  price: number;
  currency: string;
  rating: number;
  review_count: number;
  max_participants: number;
  meeting_point: string;
  latitude: number;
  longitude: number;
  includes: string[];
  languages: string[];
  guide_name: string;
  is_featured: boolean;
}

export interface ProviderBrief {
  id: UUID;
  name: string;
  logo_url?: string | null;
  rating: number;
}

export interface TransportOffer {
  id: UUID;
  code: string;
  type: "flight" | "train" | "bus" | "car" | "taxi";
  provider: ProviderBrief;
  origin: DestinationBrief;
  destination: DestinationBrief;
  departure_at: string;
  arrival_at: string;
  duration_minutes: number;
  price: number;
  currency: string;
  stops: number;
  seats_available: number;
  rating: number;
  comfort_score: number;
  baggage_allowance?: string | null;
  amenities: string[];
  cancellation_policy?: string | null;
  change_policy?: string | null;
}

export interface AccommodationCard {
  id: UUID;
  slug: string;
  name: string;
  type: string;
  destination_id: UUID;
  destination_name: string;
  short_description: string;
  address: string;
  latitude: number;
  longitude: number;
  images: string[];
  star_rating: number;
  guest_rating: number;
  review_count: number;
  amenities: string[];
  base_price: number;
  min_price: number;
  total_price: number;
  nights: number;
  rooms_available: number;
  distance_to_center_km: number;
  breakfast_included: boolean;
  free_cancellation: boolean;
  is_featured: boolean;
  cancellation_policy?: string | null;
}

export interface Room {
  id: UUID;
  name: string;
  room_type: string;
  description: string;
  capacity: number;
  beds: string;
  size_sqm: number;
  total_rooms: number;
  price_per_night: number;
  amenities: string[];
  images: string[];
  breakfast_included: boolean;
  refundable: boolean;
  rooms_left?: number | null;
}

export interface Accommodation extends AccommodationCard {
  description: string;
  video_url?: string | null;
  rules: string[];
  policies: Record<string, string>;
  rooms: Room[];
  nearby_attractions: { id: UUID; name: string; image_url?: string | null; distance_km?: number }[];
}

export interface Review {
  id: UUID;
  user: { id: UUID; full_name: string; avatar_url?: string | null };
  entity_type: string;
  entity_id: UUID;
  rating: number;
  title?: string | null;
  body: string;
  photos: string[];
  cleanliness?: number | null;
  location_score?: number | null;
  service?: number | null;
  value?: number | null;
  experience_score?: number | null;
  is_verified: boolean;
  status: string;
  helpful_count: number;
  response?: string | null;
  created_at: string;
}

export interface HomeData {
  featured_destinations: Destination[];
  popular_destinations: Destination[];
  campaigns: Campaign[];
  featured_attractions: Attraction[];
  featured_experiences: Experience[];
  deals: { title: string; code: string; description: string }[];
  stats: { destinations: number; accommodations: number; attractions: number; experiences: number };
}

export interface User {
  id: UUID;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  locale: string;
  currency: string;
  city?: string | null;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  last_login_at?: string | null;
  created_at: string;
  privacy_settings: Record<string, unknown>;
  notification_settings: Record<string, unknown>;
}

export interface AuthResponse {
  user: User;
  tokens: { access_token: string; refresh_token: string; expires_in: number };
}

export interface Booking {
  id: UUID;
  code: string;
  booking_type: "transport" | "accommodation" | "experience";
  status: string;
  title: string;
  destination?: DestinationBrief | null;
  image_url?: string | null;
  travel_date?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  guests: number;
  rooms_count: number;
  nights: number;
  unit_price: number;
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  coupon_code?: string | null;
  passengers: {
    id?: UUID;
    first_name: string;
    last_name: string;
    national_id?: string | null;
    seat_number?: string | null;
  }[];
  payment?: Payment | null;
  details: Record<string, unknown>;
  cancellation_deadline?: string | null;
  created_at: string;
  confirmed_at?: string | null;
  cancelled_at?: string | null;
  can_cancel: boolean;
}

export interface Payment {
  id: UUID;
  booking_id: UUID;
  amount: number;
  currency: string;
  method: string;
  status: string;
  reference: string;
  gateway: string;
  refunded_amount: number;
  paid_at?: string | null;
  created_at: string;
  gateway_payload?: Record<string, unknown>;
}

export interface PaymentResult {
  payment: Payment;
  booking: Booking;
  message: string;
}

export interface TripActivity {
  id: UUID;
  activity_type: string;
  title: string;
  description: string;
  start_time: string;
  end_time?: string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  cost: number;
  entity_type?: string | null;
  entity_id?: UUID | null;
  is_done: boolean;
  metadata_json: Record<string, unknown>;
}

export interface TripDay {
  id: UUID;
  day_number: number;
  date: string;
  title: string;
  notes?: string | null;
  estimated_cost: number;
  activities: TripActivity[];
}

export interface Trip {
  id: UUID;
  title: string;
  status: string;
  destination: DestinationBrief;
  origin?: DestinationBrief | null;
  start_date: string;
  end_date: string;
  travelers: number;
  budget: number;
  spent: number;
  budget_breakdown: Record<string, number>;
  interests: string[];
  cover_image?: string | null;
  notes?: string | null;
  is_public: boolean;
  share_slug?: string | null;
  days: TripDay[];
  bookings?: BookingSummary[];
  created_at?: string;
}

export interface BookingSummary {
  id: UUID;
  code: string;
  booking_type: string;
  status: string;
  title: string;
  total: number;
  currency: string;
  image_url?: string | null;
  travel_date?: string | null;
  check_in?: string | null;
  check_out?: string | null;
}

export interface WalletTransaction {
  id: UUID;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  reference?: string | null;
  created_at: string;
}

export interface Wallet {
  id: UUID;
  balance: number;
  currency: string;
  points: number;
  xp: number;
  level: string;
  next_level?: string | null;
  xp_to_next_level: number;
  transactions: WalletTransaction[];
}

export interface Notification {
  id: UUID;
  title: string;
  body: string;
  notification_type: string;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface Achievement {
  id: UUID;
  code: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  xp_reward: number;
  unlocked: boolean;
  awarded_at?: string | null;
}

export interface Challenge {
  id: UUID;
  code: string;
  title: string;
  description: string;
  icon: string;
  xp_reward: number;
  target: number;
  progress: number;
  completed: boolean;
  ends_at?: string | null;
}

export interface Gamification {
  xp: number;
  points: number;
  level: string;
  next_level?: string | null;
  xp_to_next_level: number;
  level_progress: number;
  stamps: {
    destination_id: UUID;
    name: string;
    slug: string;
    country: string;
    image_url?: string | null;
    visited_at: string;
  }[];
  achievements: Achievement[];
  challenges: Challenge[];
}

export interface ItineraryActivity {
  time: string;
  end_time?: string | null;
  title: string;
  description?: string;
  location_name?: string | null;
  cost?: number;
  activity_type?: string;
  entity_type?: string | null;
  entity_id?: UUID | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ItineraryDay {
  day_number: number;
  date: string;
  title: string;
  estimated_cost: number;
  activities: ItineraryActivity[];
}

export interface TripPlan {
  destination: DestinationBrief;
  title: string;
  days: ItineraryDay[];
  estimated_total: number;
  budget: number;
  budget_remaining: number;
  budget_breakdown: Record<string, number>;
  suggested_hotel?: Record<string, unknown> | null;
  suggested_transport?: Record<string, unknown> | null;
  tips: string[];
}

export interface AssistantResponse {
  reply: string;
  intent: string;
  follow_up_questions: string[];
  destination?: DestinationBrief | null;
  plan?: TripPlan | null;
  suggestions: Record<string, unknown>[];
}

export interface Favorite {
  id: UUID;
  entity_type: string;
  entity_id: UUID;
  title: string;
  subtitle?: string;
  image_url?: string | null;
  slug?: string | null;
  url?: string | null;
  rating?: number | null;
  price?: number | null;
  created_at: string;
}

export interface MapData {
  center: { lat: number; lng: number };
  markers: {
    id: UUID;
    type: string;
    name: string;
    lat: number;
    lng: number;
    rating?: number | null;
    image?: string | null;
    price?: number | null;
    slug?: string | null;
  }[];
}

export interface AdminStats {
  total_users: number;
  active_users_30d: number;
  new_users_30d: number;
  total_bookings: number;
  bookings_30d: number;
  confirmed_bookings: number;
  cancelled_bookings: number;
  revenue_total: number;
  revenue_30d: number;
  average_booking_value: number;
  conversion_rate: number;
  cancellation_rate: number;
  total_providers: number;
  total_destinations: number;
  total_reviews: number;
  pending_reviews: number;
  revenue_series: { month: string; revenue: number; bookings?: number }[];
  bookings_by_type: Record<string, number>;
  popular_destinations: { name: string; bookings: number; revenue?: number }[];
  popular_transport: { type: string; count: number }[];
  recent_bookings: Booking[];
  top_events: { event_type: string; count: number }[];
}

export interface ProviderDashboard {
  provider_id: UUID;
  provider_name: string;
  provider_type: string;
  rating: number;
  total_bookings: number;
  confirmed_bookings: number;
  revenue: number;
  commission: number;
  net_revenue: number;
  services_count: number;
  upcoming_bookings: Booking[];
  monthly_revenue: { month: string; revenue: number; bookings?: number }[];
}

export interface AdminUser {
  id: UUID;
  email?: string | null;
  phone?: string | null;
  full_name: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  city?: string | null;
  created_at: string;
  last_login_at?: string | null;
  bookings_count: number;
  total_spent: number;
}

export interface SupportTicket {
  id: UUID;
  subject: string;
  category: string;
  message: string;
  status: string;
  priority: string;
  response?: string | null;
  created_at: string;
}

export interface Option {
  value: string;
  label: string;
  icon?: string;
}

export interface MetaOptions {
  transport_types: Option[];
  accommodation_types: Option[];
  attraction_categories: Option[];
  experience_categories: Option[];
  amenities: Option[];
  interests: Option[];
  cities: { id: UUID; name: string; name_local?: string }[];
  budget_ranges: { value: string; label: string }[];
}
