import { Box, AppBar, Toolbar, Typography, Button, Drawer, List, ListItemButton, ListItemText, Divider } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const DRAWER_WIDTH = 220;

const navItems = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Datasets", path: "/data" },
  { label: "Pipelines", path: "/pipelines" },
  { label: "Model Registry", path: "/models" },
  { label: "Company", path: "/company" },
  { label: "Billing", path: "/billing" },
  { label: "Profile", path: "/profile" },
];

const adminItems = [
  { label: "Admin Panel", path: "/admin" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            NoCode AI Platform
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {user?.email}
          </Typography>
          <Button color="inherit" onClick={logout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: "auto" }}>
          <List>
            {navItems.map((item) => (
              <ListItemButton key={item.path} onClick={() => navigate(item.path)}>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
          {user?.role === "super_admin" && (
            <>
              <Divider />
              <List>
                {adminItems.map((item) => (
                  <ListItemButton key={item.path} onClick={() => navigate(item.path)}>
                    <ListItemText primary={item.label} primaryTypographyProps={{ color: "error", fontWeight: 600 }} />
                  </ListItemButton>
                ))}
              </List>
            </>
          )}
          <Divider />
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
