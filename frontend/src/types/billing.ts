export type PlanId =
  | "free"
  | "solo_monthly"
  | "solo_yearly"
  | "company_monthly"
  | "company_yearly";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete";

export interface Plan {
  plan: PlanId;
  name: string;
  price_usd: number;
  interval: "month" | "year" | null;
  tier: string;
}

export interface Subscription {
  plan: PlanId;
  status: SubscriptionStatus;
  trial_end: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}
