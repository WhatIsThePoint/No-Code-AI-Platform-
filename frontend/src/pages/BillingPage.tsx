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
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { billingApi } from "../api/billing";
import type { Plan, Subscription } from "../types/billing";
import { useAuthStore } from "../store/authSlice";

const FEATURES: Record<string, string[]> = {
  free: ["3 datasets", "2 pipelines", "5 training runs", "10 MB file limit"],
  solo: ["20 datasets", "10 pipelines", "50 training runs", "100 MB file limit", "Batch predictions", "Model comparison"],
  company: ["Unlimited datasets & pipelines", "Unlimited training runs", "500 MB file limit", "All features", "Priority support"],
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
      variant={isActive ? "elevation" : "outlined"}
      elevation={isActive ? 6 : 1}
      sx={{ height: "100%", display: "flex", flexDirection: "column", borderColor: isActive ? "primary.main" : undefined }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Typography variant="h6">{plan.name}</Typography>
          {isActive && <Chip label="Current" color="primary" size="small" />}
        </Box>

        <Typography variant="h4" sx={{ mt: 1, mb: 0.5 }}>
          {plan.price_usd === 0 ? "Free" : `$${plan.price_usd}`}
          {plan.interval && (
            <Typography component="span" variant="body2" color="text.secondary">
              /{plan.interval}
            </Typography>
          )}
        </Typography>

        {plan.plan.includes("yearly") && (
          <Chip label="Save 17%" color="success" size="small" sx={{ mb: 1 }} />
        )}

        <Divider sx={{ my: 1.5 }} />

        {features.map((f) => (
          <Box key={f} sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
            <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />
            <Typography variant="body2">{f}</Typography>
          </Box>
        ))}
      </CardContent>

      <CardActions>
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
      <Typography variant="h4" gutterBottom>Billing & Plans</Typography>

      {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg("")}>{successMsg}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      {/* Current subscription info */}
      {subscription && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom><strong>Current Plan</strong></Typography>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
              <Chip label={subscription.plan.replace("_", " ")} color="primary" />
              <Chip label={subscription.status} color={subscription.status === "active" || subscription.status === "trialing" ? "success" : "warning"} />
              {user?.tier && <Chip label={`Tier: ${user.tier}`} variant="outlined" />}
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
              <Button
                variant="outlined"
                size="small"
                sx={{ mt: 2 }}
                onClick={handlePortal}
                disabled={actionLoading}
              >
                Manage Subscription
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan cards */}
      <Typography variant="h5" gutterBottom>Available Plans</Typography>
      {actionLoading && <CircularProgress size={20} sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
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
