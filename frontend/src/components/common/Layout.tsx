import { Box, AppBar, Toolbar, Typography, Button, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Divider, Avatar, alpha, Chip } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import DashboardIcon from "@mui/icons-material/DashboardRounded";
import StorageIcon from "@mui/icons-material/StorageRounded";
import AccountTreeIcon from "@mui/icons-material/AccountTreeRounded";
import ModelTrainingIcon from "@mui/icons-material/ModelTrainingRounded";
import BusinessIcon from "@mui/icons-material/BusinessRounded";
import PaymentIcon from "@mui/icons-material/PaymentRounded";
import PersonIcon from "@mui/icons-material/PersonRounded";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import LogoutIcon from "@mui/icons-material/LogoutRounded";

const DRAWER_WIDTH = 260;

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
  { label: "Datasets", path: "/data", icon: <StorageIcon /> },
  { label: "Pipelines", path: "/pipelines", icon: <AccountTreeIcon /> },
  { label: "Model Registry", path: "/models", icon: <ModelTrainingIcon /> },
  { label: "Company", path: "/company", icon: <BusinessIcon /> },
  { label: "Billing", path: "/billing", icon: <PaymentIcon /> },
  { label: "Profile", path: "/profile", icon: <PersonIcon /> },
];

const adminItems = [
  { label: "Admin Panel", path: "/admin", icon: <AdminPanelSettingsIcon /> },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderBottom: "1px solid",
          borderColor: alpha("#fff", 0.08),
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          {/* Brand */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mr: 2 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "10px",
                background: "linear-gradient(135deg, #818cf8 0%, #6366f1 50%, #4f46e5 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "0.875rem",
                color: "#fff",
                letterSpacing: "-0.03em",
              }}
            >
              AI
            </Box>
            <Typography
              variant="h6"
              noWrap
              sx={{
                fontWeight: 700,
                letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              NoCode AI
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* User info */}
          <Chip
            label={user?.tier ?? "free"}
            size="small"
            sx={{
              bgcolor: alpha("#fff", 0.12),
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              height: 24,
            }}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: alpha("#fff", 0.15),
                fontSize: "0.8rem",
                fontWeight: 700,
                border: "2px solid",
                borderColor: alpha("#fff", 0.2),
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ display: { xs: "none", md: "block" } }}>
              <Typography variant="body2" sx={{ color: "#fff", fontWeight: 600, lineHeight: 1.3, fontSize: "0.8125rem" }}>
                {user?.full_name ?? user?.email}
              </Typography>
              <Typography variant="caption" sx={{ color: alpha("#fff", 0.6), fontSize: "0.7rem" }}>
                {user?.role?.replace("_", " ")}
              </Typography>
            </Box>
          </Box>
          <Button
            color="inherit"
            onClick={logout}
            startIcon={<LogoutIcon />}
            size="small"
            sx={{
              ml: 1,
              bgcolor: alpha("#fff", 0.08),
              borderRadius: 2,
              px: 2,
              "&:hover": {
                bgcolor: alpha("#fff", 0.15),
                transform: "none",
              },
            }}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            bgcolor: "#fff",
            borderRight: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: "auto", py: 1.5, display: "flex", flexDirection: "column", flex: 1 }}>
          <List sx={{ px: 0.5 }}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
              return (
                <ListItemButton
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  selected={isActive}
                  sx={{
                    mb: 0.25,
                    ...(isActive && {
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        left: 0,
                        top: "20%",
                        bottom: "20%",
                        width: 3,
                        borderRadius: "0 4px 4px 0",
                        bgcolor: "primary.main",
                      },
                    }),
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: isActive ? "primary.main" : "text.secondary",
                      transition: "color 0.2s ease",
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: "0.875rem",
                      fontWeight: isActive ? 600 : 500,
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>

          {user?.role === "super_admin" && (
            <>
              <Divider sx={{ mx: 2, my: 1 }} />
              <List sx={{ px: 0.5 }}>
                {adminItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <ListItemButton
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      selected={isActive}
                      sx={{
                        mb: 0.25,
                        ...(isActive && {
                          bgcolor: alpha("#ef4444", 0.08),
                          "&:hover": { bgcolor: alpha("#ef4444", 0.12) },
                          "&::before": {
                            content: '""',
                            position: "absolute",
                            left: 0,
                            top: "20%",
                            bottom: "20%",
                            width: 3,
                            borderRadius: "0 4px 4px 0",
                            bgcolor: "error.main",
                          },
                        }),
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40, color: "error.main" }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          color: "error.main",
                          fontWeight: 600,
                          fontSize: "0.875rem",
                        }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </>
          )}

          {/* Bottom spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Footer */}
          <Box sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem" }}>
              NoCode AI Platform v3.0
            </Typography>
          </Box>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 4 },
          maxWidth: "100%",
          overflow: "auto",
        }}
      >
        <Toolbar />
        <Box className="animate-fade-in-up" sx={{ maxWidth: 1400, mx: "auto" }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
