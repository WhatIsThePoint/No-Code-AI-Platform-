import api from "./axios";
import type { Plan, Subscription, Announcement } from "../types/billing";

export const billingApi = {
  getPlans: () => api.get<Plan[]>("/billing/plans"),

  getSubscription: () => api.get<Subscription>("/billing/subscription"),

  createCheckout: (plan: string) =>
    api.post<{ checkout_url: string }>("/billing/checkout", { plan }),

  createPortal: () =>
    api.post<{ portal_url: string }>("/billing/portal", {}),

  getAnnouncements: () => api.get<Announcement[]>("/announcements"),
};
