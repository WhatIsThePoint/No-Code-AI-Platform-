export interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  tier: string;
  is_active: boolean;
  totp_enabled?: boolean;
  created_at: string;
}

export interface AdminCompany {
  company_id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string | null;
}

export interface AdminSubscription {
  user_id: string;
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  current_period_end: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface PlatformStats {
  total_users: number;
  active_users: number;
  suspended_users: number;
  total_companies: number;
  paid_subscriptions: number;
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  is_active: boolean;
  created_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
}
