import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Typography,
  alpha,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PaymentIcon from "@mui/icons-material/PaymentRounded";
import { billingApi } from "../api/billing";
import type { Plan, Subscription } from "../types/billing";
import { useAuthStore } from "../store/authSlice";

const FEATURES: Record<string, string[]> = {
  free: ["3 datasets", "2 pipelines", "5 training runs", "10 MB file limit"],
  solo: ["20 datasets", "10 pipelines", "50 training runs", "100 MB file limit", "Batch predictions", "Model comparison"],
  company: ["Unlimited datasets & pipelines", "Unlimited training runs", "500 MB file limit", "All features", "Priority support"],
};

const TIER_GRADIENT: Record<string, string> = {
  free: "linear-gradient(135deg, #94a3b8, #64748b)",
  solo: "linear-gradient(135deg, #d2541c, #a8401a)",
  company: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
};

function PlanCard({
  plan,
  current,
  onSelect,
}: {
  plan: Plan;
  current: Subscription | null;
  onSelect: (plan: string) => void;
}) {
  const isActive = current?.plan === plan.plan && current?.status !== "canceled";
  const tier = plan.tier;
  const features = FEATURES[tier] ?? [];

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderColor: isActive ? "#d2541c" : undefined,
        borderWidth: isActive ? 2 : 1,
        borderStyle: "solid",
        position: "relative",
        overflow: "visible",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: `0 12px 32px -8px ${alpha("#d2541c", 0.18)}`,
        },
      }}
    >
      {isActive && (
        <Box
          sx={{
            position: "absolute",
            top: -12,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <Chip
            label="Current Plan"
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: "0.65rem",
              background: "linear-gradient(135deg, #d2541c, #8b5cf6)",
              color: "#fff",
            }}
          />
        </Box>
      )}
      <Box
        sx={{
          height: 4,
          borderRadius: "16px 16px 0 0",
          background: TIER_GRADIENT[tier] ?? TIER_GRADIENT.free,
        }}
      />
      <CardContent sx={{ flexGrow: 1, pt: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{plan.name.replace(/Company/gi, "Collaborator")}</Typography>

        <Typography variant="h3" sx={{ mt: 1, mb: 0.5, fontWeight: 800 }}>
          {plan.price_usd === 0 ? "Free" : `$${plan.price_usd}`}
          {plan.interval && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
              /{plan.interval}
            </Typography>
          )}
        </Typography>

        {plan.plan.includes("yearly") && (
          <Chip
            label="Save 17%"
            size="small"
            sx={{
              mb: 1,
              fontWeight: 600,
              fontSize: "0.65rem",
              bgcolor: alpha("#10b981", 0.1),
              color: "#059669",
            }}
          />
        )}

        <Divider sx={{ my: 2 }} />

        {features.map((f) => (
          <Box key={f} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
            <CheckCircleIcon sx={{ fontSize: 16, color: "#10b981" }} />
            <Typography variant="body2">{f}</Typography>
          </Box>
        ))}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        {plan.price_usd === 0 ? (
          <Button disabled fullWidth variant="outlined">
            {isActive ? "Your current plan" : "Downgrade"}
          </Button>
        ) : (
          <Button
            fullWidth
            variant={isActive ? "outlined" : "contained"}
            disabled={isActive}
            onClick={() => onSelect(plan.plan)}
          >
            {isActive ? "Active" : "Subscribe"}
          </Button>
        )}
      </CardActions>
    </Card>
  );
}

export function BillingPage() {
  const user = useAuthStore((s) => s.user);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) setSuccessMsg("Subscription activated! Thank you.");
    if (params.get("canceled")) setError("Checkout was canceled.");
  }, []);

  useEffect(() => {
    Promise.all([billingApi.getPlans(), billingApi.getSubscription()])
      .then(([plansRes, subRes]) => {
        setPlans(plansRes.data);
        setSubscription(subRes.data);
      })
      .catch(() => setError("Failed to load billing info"))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (plan: string) => {
    setActionLoading(true);
    setError("");
    try {
      const res = await billingApi.createCheckout(plan);
      window.location.href = res.data.checkout_url;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      if (msg?.error === "billing_unavailable") {
        setError("Stripe is not configured in this environment. This is a demo.");
      } else {
        setError(msg?.message || "Failed to start checkout");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handlePortal = async () => {
    setActionLoading(true);
    try {
      const res = await billingApi.createPortal();
      window.location.href = res.data.portal_url;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      if (msg?.error === "billing_unavailable") {
        setError("Stripe is not configured in this environment. This is a demo.");
      } else if (msg?.error === "no_subscription") {
        setError("No active subscription to manage.");
      } else {
        setError("Failed to open billing portal");
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;

  const hasPaidSub = subscription && subscription.plan !== "free" && subscription.status !== "canceled";

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "12px",
            background: "linear-gradient(135deg, #d2541c, #a8401a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <PaymentIcon sx={{ fontSize: 22 }} />
        </Box>
        <Typography variant="h4">Billing & Plans</Typography>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg("")}>{successMsg}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      {subscription && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>Current Plan</Typography>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
              <Chip
                label={subscription.plan.replace(/^company/, "collaborator").replace("_", " ")}
                sx={{
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #d2541c, #8b5cf6)",
                  color: "#fff",
                }}
              />
              <Chip
                label={subscription.status}
                size="small"
                sx={{
                  fontWeight: 600,
                  bgcolor: subscription.status === "active" || subscription.status === "trialing"
                    ? alpha("#10b981", 0.1) : alpha("#f59e0b", 0.1),
                  color: subscription.status === "active" || subscription.status === "trialing"
                    ? "#059669" : "#d97706",
                }}
              />
              {user?.tier && (
                <Chip
                  label={`Tier: ${user.tier}`}
                  variant="outlined"
                  size="small"
                  sx={{ borderColor: alpha("#d2541c", 0.3), color: "#d2541c" }}
                />
              )}
              {subscription.trial_end && (
                <Typography variant="body2" color="text.secondary">
                  Trial ends: {new Date(subscription.trial_end).toLocaleDateString()}
                </Typography>
              )}
              {subscription.current_period_end && (
                <Typography variant="body2" color="text.secondary">
                  Renews: {new Date(subscription.current_period_end).toLocaleDateString()}
                </Typography>
              )}
            </Box>
            {hasPaidSub && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handlePortal}
                  disabled={actionLoading}
                >
                  Manage Subscription
                </Button>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Requires Stripe configuration
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>Available Plans</Typography>
      {actionLoading && <CircularProgress size={20} sx={{ mb: 2 }} />}

      <Grid container spacing={3} className="stagger-children" sx={{ mt: 0.5 }}>
        {plans.map((plan) => (
          <Grid item xs={12} sm={6} md={4} key={plan.plan}>
            <PlanCard plan={plan} current={subscription} onSelect={handleSelect} />
          </Grid>
        ))}
      </Grid>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
        All plans include a 14-day free trial. Cancel anytime.
      </Typography>
    </Box>
  );
}
