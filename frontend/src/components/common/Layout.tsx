import { Box, AppBar, Toolbar, Typography, Button, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Divider, Avatar, Chip } from "@mui/material";
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
import { PlatformCompanion } from "../companion/PlatformCompanion";

const DRAWER_WIDTH = 260;

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
  { label: "Datasets", path: "/data", icon: <StorageIcon /> },
  { label: "Pipelines", path: "/pipelines", icon: <AccountTreeIcon /> },
  { label: "Model Registry", path: "/models", icon: <ModelTrainingIcon /> },
  { label: "Collaborator", path: "/company", icon: <BusinessIcon /> },
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
  const isAdmin = user?.role === "super_admin";
  const visibleNavItems = isAdmin ? [] : navItems;

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          {/* Brand */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mr: 2 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "2px",
                bgcolor: "#0b0d0e",
                color: "#fafaf7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.7rem",
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.04em",
              }}
            >
              AI
            </Box>
            <Typography
              variant="subtitle1"
              noWrap
              sx={{
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "#0b0d0e",
              }}
            >
              NoCode AI
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* User info */}
          <Chip
            label={(user?.tier === "company" ? "collaborator" : user?.tier) ?? "free"}
            size="small"
            variant="outlined"
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ width: 30, height: 30, fontSize: "0.7rem" }}>
              {initials}
            </Avatar>
            <Box sx={{ display: { xs: "none", md: "block" } }}>
              <Typography
                variant="body2"
                sx={{ color: "#0b0d0e", fontWeight: 600, lineHeight: 1.3, fontSize: "0.8125rem" }}
              >
                {user?.full_name ?? user?.email}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: "0.65rem" }}>
                {user?.role?.replace("_", " ")}
              </Typography>
            </Box>
          </Box>
          <Button
            onClick={logout}
            startIcon={<LogoutIcon sx={{ fontSize: 14 }} />}
            size="small"
            variant="outlined"
            sx={{ ml: 1 }}
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
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: "auto", py: 1.5, display: "flex", flexDirection: "column", flex: 1 }}>
          <List sx={{ px: 0.5 }}>
            {visibleNavItems.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
              return (
                <ListItemButton
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  selected={isActive}
                  sx={{
                    position: "relative",
                    ...(isActive && {
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        bgcolor: "primary.main",
                      },
                    }),
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 36,
                      color: isActive ? "primary.main" : "text.secondary",
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              );
            })}
          </List>

          {isAdmin && (
            <>
              {visibleNavItems.length > 0 && <Divider sx={{ mx: 2, my: 1 }} />}
              <List sx={{ px: 0.5 }}>
                {adminItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <ListItemButton
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      selected={isActive}
                      sx={{
                        position: "relative",
                        ...(isActive && {
                          "&::before": {
                            content: '""',
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            bgcolor: "primary.main",
                          },
                        }),
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, color: isActive ? "primary.main" : "text.secondary" }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontWeight: isActive ? 700 : 500 }}
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

      <PlatformCompanion />
    </Box>
  );
}
