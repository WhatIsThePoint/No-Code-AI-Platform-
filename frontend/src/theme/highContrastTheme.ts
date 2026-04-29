/**
 * High-contrast theme variant.
 *
 * Built by extending the base Parity theme rather than re-declaring it from
 * scratch — every component override stays in sync, only the palette and a
 * handful of borders are stiffened to clear WCAG AA across the app.
 */

import { createTheme, alpha } from "@mui/material/styles";
import { theme as baseTheme } from "./muiTheme";

const HC_PAPER = "#ffffff";
const HC_INK = "#000000";
const HC_INK_SOFT = "#0b0d0e";
const HC_MUTED = "#3a3a36"; // 7.4:1 against white — was 4.4:1 in the base
const HC_RULE = "#0b0d0e"; // borders become hard ink so cards have real edges
const HC_RULE_SOFT = "#5a5a52";
const HC_ACCENT = "#a8401a"; // darker than base ACCENT for better contrast
const HC_ACCENT_DARK = "#7a2f12";
const HC_OK = "#1d4f29";
const HC_BAD = "#852e2e";
const HC_WARN = "#6f4f19";
const HC_INFO = "#2a4570";

export const highContrastTheme = createTheme(baseTheme, {
  palette: {
    primary: {
      main: HC_ACCENT,
      dark: HC_ACCENT_DARK,
      light: HC_ACCENT,
      contrastText: HC_PAPER,
    },
    secondary: {
      main: HC_INK,
      dark: HC_INK,
      light: HC_INK_SOFT,
      contrastText: HC_PAPER,
    },
    success: { main: HC_OK, dark: HC_OK, light: HC_OK, contrastText: HC_PAPER },
    warning: { main: HC_WARN, dark: HC_WARN, light: HC_WARN, contrastText: HC_PAPER },
    error: { main: HC_BAD, dark: HC_BAD, light: HC_BAD, contrastText: HC_PAPER },
    info: { main: HC_INFO, dark: HC_INFO, light: HC_INFO, contrastText: HC_PAPER },
    background: { default: HC_PAPER, paper: HC_PAPER },
    text: { primary: HC_INK, secondary: HC_MUTED },
    divider: HC_RULE,
  },

  components: {
    // Force every Card / Paper edge to a hard 1px ink line — no faint dividers.
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          borderColor: HC_RULE,
          borderWidth: 1,
          background: HC_PAPER,
          boxShadow: "none",
          backgroundImage: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { background: HC_PAPER, boxShadow: "none", borderRadius: 2 },
        outlined: { borderColor: HC_RULE, borderWidth: 1 },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: HC_RULE_SOFT, borderBottomWidth: 1 } },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          background: HC_PAPER,
          color: HC_INK,
          borderBottom: `2px solid ${HC_RULE}`,
          boxShadow: "none",
        },
        colorPrimary: { background: HC_PAPER, color: HC_INK },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: false },
      styleOverrides: {
        contained: {
          boxShadow: "none",
          fontWeight: 700,
          "&:hover": { boxShadow: "none" },
        },
        containedPrimary: {
          background: HC_INK,
          color: HC_PAPER,
          "&:hover": { background: "#000" },
        },
        outlined: {
          borderWidth: 2, // beefier than the 1px in base
          borderColor: HC_INK,
          color: HC_INK,
          fontWeight: 700,
          "&:hover": { borderWidth: 2, borderColor: HC_INK, background: alpha(HC_INK, 0.06) },
        },
        text: {
          color: HC_INK,
          fontWeight: 700,
          "&:hover": { background: alpha(HC_INK, 0.06) },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          color: HC_INK,
          "&:hover": { background: alpha(HC_INK, 0.08), color: HC_INK },
          // Visible focus ring — base theme inherits MUI's default 1px shadow,
          // which is invisible on the cream paper. AA needs ≥3px.
          "&:focus-visible": {
            outline: `3px solid ${HC_ACCENT}`,
            outlineOffset: 2,
          },
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-notchedOutline": { borderColor: HC_INK, borderWidth: 1 },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: HC_INK, borderWidth: 1 },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderWidth: 2,
            borderColor: HC_ACCENT,
          },
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          color: HC_MUTED,
          "&.Mui-selected": { color: HC_INK, fontWeight: 800 },
          "&:focus-visible": {
            outline: `3px solid ${HC_ACCENT}`,
            outlineOffset: -3,
          },
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        root: { borderBottom: `2px solid ${HC_RULE}` },
        indicator: { height: 3, background: HC_ACCENT },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          border: `1px solid ${HC_RULE}`,
          color: HC_INK,
          background: HC_PAPER,
        },
        colorPrimary: { borderColor: HC_ACCENT, color: HC_ACCENT },
        colorSuccess: { borderColor: HC_OK, color: HC_OK },
        colorWarning: { borderColor: HC_WARN, color: HC_WARN },
        colorError: { borderColor: HC_BAD, color: HC_BAD },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderWidth: 2,
          fontWeight: 600,
          color: HC_INK,
        },
        standardSuccess: { borderColor: HC_OK, color: HC_OK },
        standardError: { borderColor: HC_BAD, color: HC_BAD },
        standardWarning: { borderColor: HC_WARN, color: HC_WARN },
        standardInfo: { borderColor: HC_INFO, color: HC_INFO },
      },
    },

    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: HC_PAPER, color: HC_INK },
        "::selection": { background: HC_INK, color: HC_PAPER },
        // Global focus ring for keyboard nav across links + buttons.
        "a:focus-visible, button:focus-visible, [role=button]:focus-visible": {
          outline: `3px solid ${HC_ACCENT}`,
          outlineOffset: 2,
        },
      },
    },
  },
});
