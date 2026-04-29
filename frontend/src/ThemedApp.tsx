import { CssBaseline, ThemeProvider } from "@mui/material";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { theme } from "./theme/muiTheme";
import { highContrastTheme } from "./theme/highContrastTheme";
import { useThemeStore } from "./theme/themeStore";

export function ThemedApp() {
  const mode = useThemeStore((s) => s.mode);
  const active = mode === "highContrast" ? highContrastTheme : theme;
  return (
    <ThemeProvider theme={active}>
      <CssBaseline />
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </ThemeProvider>
  );
}
