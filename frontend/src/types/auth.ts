export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: "data_scientist" | "engineer" | "analyst" | "super_admin";
  tier: "free" | "solo" | "company" | "super_admin";
  totp_enabled: boolean;
  has_seen_pipeline_tour?: boolean;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

export interface LoginResponse {
  access_token?: string;
  token_type?: string;
  requires_2fa?: boolean;
  session_token?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name?: string;
  role?: string;
}
