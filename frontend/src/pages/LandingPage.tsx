import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Rating,
  Typography,
  alpha,
} from "@mui/material";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";

const FEATURES = [
  {
    icon: <StorageRoundedIcon />,
    title: "Smart Data Ingestion",
    desc: "Upload CSV, connect to PostgreSQL or MySQL, and get instant profiling with distribution charts and correlation heatmaps.",
    gradient: "linear-gradient(135deg, #6366f1, #4f46e5)",
  },
  {
    icon: <AccountTreeRoundedIcon />,
    title: "Visual Pipeline Builder",
    desc: "Drag-and-drop nodes to build end-to-end ML pipelines. Connect datasets, preprocessing, training, and evaluation visually.",
    gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
  },
  {
    icon: <AutoFixHighRoundedIcon />,
    title: "One-Click Training",
    desc: "Choose from XGBoost, Random Forest, LightGBM, CatBoost, Ridge, and more. Tune hyperparameters with intuitive sliders.",
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
  },
  {
    icon: <InsightsRoundedIcon />,
    title: "Explainable AI (SHAP)",
    desc: "Understand every prediction with SHAP global importance charts and residual analysis. Built-in, not an afterthought.",
    gradient: "linear-gradient(135deg, #10b981, #059669)",
  },
  {
    icon: <SecurityRoundedIcon />,
    title: "Enterprise Security",
    desc: "JWT authentication with refresh tokens, optional two-factor (TOTP), role-based access, and encrypted data at rest.",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
  },
  {
    icon: <GroupsRoundedIcon />,
    title: "Team Collaboration",
    desc: "Create companies, invite teammates with granular roles, and share pipelines and models across your organization.",
    gradient: "linear-gradient(135deg, #ec4899, #db2777)",
  },
];

const STEPS = [
  { num: "01", title: "Upload Your Data", desc: "Drag a CSV or connect a database. Profiling runs automatically." },
  { num: "02", title: "Build a Pipeline", desc: "Wire dataset, preprocessing, and training nodes on a visual canvas." },
  { num: "03", title: "Train & Evaluate", desc: "Pick an algorithm, tweak hyperparameters, and hit Run. Results in seconds." },
  { num: "04", title: "Explain & Export", desc: "Review SHAP charts, compare models side-by-side, and download artifacts." },
];

const REVIEWS = [
  {
    name: "Sarah Nguyen",
    role: "Data Scientist @ Finova",
    avatar: "SN",
    color: "#6366f1",
    rating: 5,
    text: "We went from weeks of boilerplate to deploying models in an afternoon. The SHAP integration alone saved us hours of explaining results to stakeholders.",
  },
  {
    name: "James Okafor",
    role: "ML Engineer @ HealthBridge",
    avatar: "JO",
    color: "#10b981",
    rating: 5,
    text: "The visual pipeline builder is incredibly intuitive. Our junior analysts can now build and evaluate models without writing a single line of Python.",
  },
  {
    name: "Lina Petrov",
    role: "Analytics Lead @ RetailQ",
    avatar: "LP",
    color: "#8b5cf6",
    rating: 4,
    text: "Correlation heatmaps, distribution charts, feature importance — all right there when you need them. It's like having a senior data scientist on call 24/7.",
  },
  {
    name: "Marcus Chen",
    role: "CTO @ EdTech Labs",
    avatar: "MC",
    color: "#3b82f6",
    rating: 5,
    text: "We onboarded 15 team members in a single day. The guided stepper and tour made it dead simple. Easily the best low-code ML platform we've tried.",
  },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ bgcolor: "#fafbff", overflow: "hidden" }}>
      {/* ── Navbar ─────────────────────────────────────── */}
      <Box
        component="nav"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          backdropFilter: "blur(16px)",
          bgcolor: alpha("#fafbff", 0.85),
          borderBottom: "1px solid",
          borderColor: alpha("#6366f1", 0.08),
        }}
      >
        <Container maxWidth="lg" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "12px",
                background: "linear-gradient(135deg, #818cf8, #6366f1, #4f46e5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "0.95rem",
                color: "#fff",
                boxShadow: `0 4px 14px -2px ${alpha("#6366f1", 0.4)}`,
              }}
            >
              AI
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a" }}>
              NoCode AI
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button variant="text" onClick={() => navigate("/login")} sx={{ color: "text.secondary", fontWeight: 600 }}>
              Sign In
            </Button>
            <Button variant="contained" onClick={() => navigate("/register")} size="small">
              Get Started Free
            </Button>
          </Box>
        </Container>
      </Box>

      {/* ── Hero ─────────────────────────────────────── */}
      <Box
        sx={{
          position: "relative",
          pt: { xs: 8, md: 14 },
          pb: { xs: 10, md: 16 },
          textAlign: "center",
          "&::before": {
            content: '""',
            position: "absolute",
            width: "800px",
            height: "800px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${alpha("#6366f1", 0.1)} 0%, transparent 70%)`,
            top: "-300px",
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "none",
          },
          "&::after": {
            content: '""',
            position: "absolute",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${alpha("#8b5cf6", 0.07)} 0%, transparent 70%)`,
            bottom: "-100px",
            right: "-100px",
            pointerEvents: "none",
          },
        }}
      >
        <Container maxWidth="md" className="animate-fade-in-up" sx={{ position: "relative", zIndex: 1 }}>
          <Chip
            label="Now with SHAP Explainability & Plotly Profiling"
            sx={{
              mb: 3,
              fontWeight: 600,
              bgcolor: alpha("#6366f1", 0.08),
              color: "#4f46e5",
              border: "1px solid",
              borderColor: alpha("#6366f1", 0.15),
              fontSize: "0.8rem",
              py: 0.25,
            }}
          />
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: "2.5rem", sm: "3.5rem", md: "4.25rem" },
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: "-0.035em",
              mb: 2.5,
              color: "#0f172a",
            }}
          >
            Build ML models
            <br />
            <Box
              component="span"
              sx={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6, #6366f1)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundSize: "200% auto",
                animation: "gradient-shift 4s ease infinite",
              }}
            >
              without writing code
            </Box>
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: "text.secondary",
              fontWeight: 400,
              maxWidth: 600,
              mx: "auto",
              mb: 5,
              lineHeight: 1.6,
              fontSize: { xs: "1rem", md: "1.2rem" },
            }}
          >
            Upload data, build visual pipelines, train models, and explain predictions — all from an intuitive, guided interface designed for everyone.
          </Typography>
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate("/register")}
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                px: 4,
                py: 1.6,
                fontSize: "1rem",
                borderRadius: "14px",
                boxShadow: `0 8px 30px -4px ${alpha("#6366f1", 0.45)}`,
              }}
            >
              Get Started Free
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate("/login")}
              sx={{
                px: 4,
                py: 1.6,
                fontSize: "1rem",
                borderRadius: "14px",
                borderWidth: 2,
                "&:hover": { borderWidth: 2 },
              }}
            >
              Sign In
            </Button>
          </Box>

          {/* Trust bar */}
          <Box sx={{ mt: 6, display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap", opacity: 0.55 }}>
            {["XGBoost", "LightGBM", "CatBoost", "Random Forest", "Ridge", "SHAP"].map((t) => (
              <Typography key={t} variant="body2" sx={{ fontWeight: 700, letterSpacing: "0.05em", fontSize: "0.75rem", textTransform: "uppercase" }}>
                {t}
              </Typography>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ── Features ─────────────────────────────────── */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: "#fff" }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", mb: 8 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, mb: 1.5, fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
              Everything you need to ship ML
            </Typography>
            <Typography variant="body1" sx={{ color: "text.secondary", maxWidth: 560, mx: "auto" }}>
              From raw data to explainable predictions — one platform, zero boilerplate.
            </Typography>
          </Box>
          <Grid container spacing={3} className="stagger-children">
            {FEATURES.map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f.title}>
                <Card
                  sx={{
                    height: "100%",
                    border: "1px solid",
                    borderColor: alpha("#6366f1", 0.08),
                    "&:hover": {
                      borderColor: alpha("#6366f1", 0.2),
                      boxShadow: `0 16px 40px -12px ${alpha("#6366f1", 0.12)}`,
                      transform: "translateY(-6px)",
                    },
                  }}
                >
                  <CardContent sx={{ p: 3.5 }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "14px",
                        background: f.gradient,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        mb: 2.5,
                        "& .MuiSvgIcon-root": { fontSize: 24 },
                      }}
                    >
                      {f.icon}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      {f.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
                      {f.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── How It Works ─────────────────────────────── */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", mb: 8 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, mb: 1.5, fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
              From data to insights in 4 steps
            </Typography>
            <Typography variant="body1" sx={{ color: "text.secondary", maxWidth: 480, mx: "auto" }}>
              No environment setup. No dependency hell. Just results.
            </Typography>
          </Box>
          <Grid container spacing={4}>
            {STEPS.map((s) => (
              <Grid item xs={12} sm={6} md={3} key={s.num}>
                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    sx={{
                      fontSize: "3.5rem",
                      fontWeight: 900,
                      lineHeight: 1,
                      mb: 1.5,
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      backgroundClip: "text",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {s.num}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.75 }}>
                    {s.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {s.desc}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── Reviews ──────────────────────────────────── */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: "#fff" }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", mb: 8 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, mb: 1.5, fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
              Loved by data teams
            </Typography>
            <Typography variant="body1" sx={{ color: "text.secondary", maxWidth: 480, mx: "auto" }}>
              See what ML practitioners are saying about NoCode AI.
            </Typography>
          </Box>
          <Grid container spacing={3} className="stagger-children">
            {REVIEWS.map((r) => (
              <Grid item xs={12} sm={6} md={3} key={r.name}>
                <Card
                  sx={{
                    height: "100%",
                    border: "1px solid",
                    borderColor: alpha("#6366f1", 0.08),
                    "&:hover": {
                      borderColor: alpha(r.color, 0.25),
                      boxShadow: `0 12px 32px -8px ${alpha(r.color, 0.12)}`,
                      transform: "translateY(-4px)",
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Rating value={r.rating} readOnly size="small" sx={{ mb: 2, color: "#f59e0b" }} />
                    <Typography variant="body2" sx={{ color: "text.secondary", mb: 3, lineHeight: 1.7, minHeight: 96 }}>
                      "{r.text}"
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Avatar sx={{ bgcolor: r.color, width: 36, height: 36, fontSize: "0.8rem", fontWeight: 700 }}>
                        {r.avatar}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                          {r.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {r.role}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── Pricing Teaser ───────────────────────────── */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="sm" sx={{ textAlign: "center" }}>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1.5, fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
            Start free, scale when ready
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
            Free tier includes 3 datasets, 2 pipelines, and 5 training runs. Upgrade to Solo or Company for unlimited power.
          </Typography>
          <Box sx={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap", mb: 4 }}>
            {[
              { label: "Free", price: "$0", sub: "forever" },
              { label: "Solo", price: "$29", sub: "/month" },
              { label: "Company", price: "$99", sub: "/month" },
            ].map((p) => (
              <Box
                key={p.label}
                sx={{
                  px: 3.5,
                  py: 2.5,
                  borderRadius: 4,
                  border: "1.5px solid",
                  borderColor: p.label === "Solo" ? "#6366f1" : alpha("#6366f1", 0.12),
                  bgcolor: p.label === "Solo" ? alpha("#6366f1", 0.04) : "transparent",
                  minWidth: 130,
                  transition: "all 0.2s ease",
                  "&:hover": { borderColor: "#6366f1", transform: "translateY(-2px)" },
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6366f1" }}>
                  {p.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {p.price}
                  <Typography component="span" variant="body2" sx={{ color: "text.secondary", fontWeight: 400 }}>
                    {p.sub}
                  </Typography>
                </Typography>
              </Box>
            ))}
          </Box>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate("/register")}
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{
              px: 4,
              py: 1.5,
              borderRadius: "14px",
              boxShadow: `0 8px 30px -4px ${alpha("#6366f1", 0.45)}`,
            }}
          >
            Create Free Account
          </Button>
        </Container>
      </Box>

      {/* ── Checklist / Why Us ───────────────────────── */}
      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: "#fff" }}>
        <Container maxWidth="md">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
                Why teams choose NoCode AI
              </Typography>
              <Typography variant="body1" sx={{ color: "text.secondary", mb: 3, lineHeight: 1.7 }}>
                We built the platform we wished existed — powerful enough for production, simple enough for interns.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              {[
                "6 battle-tested algorithms out of the box",
                "SHAP explainability on every tree model",
                "Correlation heatmaps & distribution charts",
                "Two-factor authentication (TOTP)",
                "Guided stepper & onboarding tour",
                "Model comparison & one-click download",
                "Role-based team access (owner, PM, analyst)",
                "14-day free trial on all paid plans",
              ].map((item) => (
                <Box key={item} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 1.75 }}>
                  <CheckCircleRoundedIcon sx={{ color: "#10b981", fontSize: 20, mt: "2px", flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.5 }}>
                    {item}
                  </Typography>
                </Box>
              ))}
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ── Footer ───────────────────────────────────── */}
      <Box sx={{ py: 5, borderTop: "1px solid", borderColor: alpha("#6366f1", 0.08) }}>
        <Container maxWidth="lg" sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: "10px",
                background: "linear-gradient(135deg, #818cf8, #6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "0.7rem",
                color: "#fff",
              }}
            >
              AI
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>NoCode AI</Typography>
          </Box>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            &copy; {new Date().getFullYear()} NoCode AI Platform. Built for ML practitioners.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
