import { createTheme, alpha } from "@mui/material/styles";

// Parity design tokens — flat, monochrome, no gradients, no shadows.
const PAPER = "#fafaf7";
const INK = "#0b0d0e";
const INK_SOFT = "#3a3a36";
const MUTED = "#6b6b65";
const RULE = "#d8d5c7";
const RULE_SOFT = "#e7e3d4";
const ACCENT = "#d2541c";
const ACCENT_DARK = "#a8401a";
const OK = "#2f6f3e";
const BAD = "#b54141";
const WARN = "#a07626";
const INFO = "#3a5a8c";

const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

export const theme = createTheme({
  palette: {
    primary: {
      main: ACCENT,
      dark: ACCENT_DARK,
      light: "#e07a47",
      contrastText: PAPER,
    },
    secondary: {
      main: INK,
      dark: "#000",
      light: INK_SOFT,
      contrastText: PAPER,
    },
    success: { main: OK, dark: "#235730", light: "#4d8f5b" },
    warning: { main: WARN, dark: "#7e5c1d", light: "#c89540" },
    error: { main: BAD, dark: "#923232", light: "#cc6666" },
    info: { main: INFO, dark: "#2a4570", light: "#5a7baa" },
    background: { default: PAPER, paper: PAPER },
    text: { primary: INK, secondary: MUTED },
    divider: RULE,
  },

  typography: {
    fontFamily: SANS,
    h1: { fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 },
    h2: { fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15 },
    h3: { fontWeight: 700, letterSpacing: "-0.015em", lineHeight: 1.2 },
    h4: { fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.25 },
    h5: { fontWeight: 600, letterSpacing: "-0.005em", lineHeight: 1.3 },
    h6: { fontWeight: 600, lineHeight: 1.35 },
    subtitle1: { fontWeight: 600, lineHeight: 1.4 },
    subtitle2: {
      fontWeight: 600,
      fontSize: "0.75rem",
      lineHeight: 1.4,
      letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      color: MUTED,
      fontFamily: MONO,
    },
    body1: { lineHeight: 1.55 },
    body2: { lineHeight: 1.55, color: INK_SOFT },
    caption: {
      lineHeight: 1.4,
      color: MUTED,
      fontFamily: MONO,
      letterSpacing: "0.04em",
    },
    button: {
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase" as const,
      fontSize: "0.75rem",
      fontFamily: MONO,
    },
    overline: {
      fontWeight: 600,
      letterSpacing: "0.12em",
      textTransform: "uppercase" as const,
      fontFamily: MONO,
      color: MUTED,
    },
  },

  shape: { borderRadius: 2 },

  // No shadows — Parity is flat. All 25 slots are "none".
  shadows: Array(25).fill("none") as unknown as import("@mui/material/styles").Shadows,

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: PAPER,
          color: INK,
        },
        "::selection": {
          background: ACCENT,
          color: PAPER,
        },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: false },
      styleOverrides: {
        root: {
          borderRadius: 2,
          textTransform: "uppercase" as const,
          fontFamily: MONO,
          fontWeight: 600,
          letterSpacing: "0.06em",
          fontSize: "0.75rem",
          padding: "8px 16px",
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        },
        contained: { boxShadow: "none", "&:hover": { boxShadow: "none" } },
        containedPrimary: {
          background: ACCENT,
          color: PAPER,
          "&:hover": { background: ACCENT_DARK },
        },
        containedSecondary: {
          background: INK,
          color: PAPER,
          "&:hover": { background: "#000" },
        },
        outlined: {
          borderWidth: 1,
          borderColor: RULE,
          color: INK,
          "&:hover": {
            borderWidth: 1,
            borderColor: INK,
            background: "transparent",
          },
        },
        outlinedPrimary: {
          borderColor: ACCENT,
          color: ACCENT,
          "&:hover": { borderColor: ACCENT_DARK, background: alpha(ACCENT, 0.04) },
        },
        text: {
          color: INK,
          "&:hover": { background: alpha(INK, 0.04) },
        },
        sizeSmall: {
          padding: "4px 10px",
          fontSize: "0.7rem",
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          color: INK_SOFT,
          "&:hover": { background: alpha(INK, 0.04), color: INK },
        },
      },
    },

    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        root: {
          borderRadius: 2,
          borderColor: RULE,
          background: PAPER,
          boxShadow: "none",
          backgroundImage: "none",
        },
      },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 2,
          background: PAPER,
          backgroundImage: "none",
          boxShadow: "none",
        },
        outlined: { borderColor: RULE },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          fontFamily: MONO,
          fontWeight: 600,
          fontSize: "0.7rem",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          height: 22,
          border: `1px solid ${RULE}`,
          background: "transparent",
          color: INK,
        },
        outlined: { background: "transparent" },
        colorPrimary: {
          background: "transparent",
          borderColor: ACCENT,
          color: ACCENT_DARK,
        },
        colorSuccess: { background: "transparent", borderColor: OK, color: OK },
        colorWarning: { background: "transparent", borderColor: WARN, color: WARN },
        colorError: { background: "transparent", borderColor: BAD, color: BAD },
        colorInfo: { background: "transparent", borderColor: INFO, color: INFO },
      },
    },

    MuiTextField: {
      defaultProps: { variant: "outlined", size: "small" },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 2,
            background: PAPER,
            fontFamily: MONO,
            fontSize: "0.85rem",
            "& .MuiOutlinedInput-notchedOutline": { borderColor: RULE },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: INK_SOFT },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderWidth: 1,
              borderColor: ACCENT,
            },
          },
          "& .MuiInputLabel-root": {
            fontFamily: MONO,
            fontSize: "0.75rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: MUTED,
          },
          "& .MuiInputLabel-root.Mui-focused": { color: ACCENT },
        },
      },
    },

    MuiSelect: {
      styleOverrides: {
        root: { borderRadius: 2, fontFamily: MONO, fontSize: "0.85rem" },
      },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: MONO,
          fontSize: "0.8rem",
          borderRadius: 0,
          "&:hover": { background: alpha(INK, 0.04) },
          "&.Mui-selected": {
            background: alpha(ACCENT, 0.08),
            "&:hover": { background: alpha(ACCENT, 0.12) },
          },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 2,
          border: `1px solid ${RULE}`,
          background: PAPER,
          boxShadow: "none",
        },
      },
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          letterSpacing: "-0.01em",
          borderBottom: `1px solid ${RULE_SOFT}`,
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: PAPER,
          borderRight: `1px solid ${RULE}`,
          boxShadow: "none",
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "uppercase" as const,
          fontFamily: MONO,
          fontWeight: 600,
          fontSize: "0.7rem",
          letterSpacing: "0.08em",
          minHeight: 40,
          borderRadius: 0,
          color: MUTED,
          "&.Mui-selected": { color: INK },
          "&:hover": { background: "transparent", color: INK },
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${RULE}`, minHeight: 40 },
        indicator: { height: 2, background: ACCENT, borderRadius: 0 },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": { background: `${alpha(INK, 0.03)} !important` },
        },
        head: {
          background: "transparent !important",
          "&:hover": { background: "transparent !important" },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${RULE_SOFT}`,
          padding: "10px 14px",
          fontFamily: MONO,
          fontSize: "0.8rem",
          color: INK,
        },
        head: {
          fontWeight: 700,
          fontSize: "0.7rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          color: MUTED,
          background: "transparent",
          borderBottom: `1px solid ${RULE}`,
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          fontWeight: 500,
          border: `1px solid ${RULE}`,
          background: PAPER,
        },
        standardSuccess: { borderColor: OK, color: OK },
        standardError: { borderColor: BAD, color: BAD },
        standardWarning: { borderColor: WARN, color: WARN },
        standardInfo: { borderColor: INFO, color: INFO },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          height: 2,
          background: RULE_SOFT,
        },
        bar: { borderRadius: 0, background: ACCENT },
      },
    },

    MuiCircularProgress: {
      styleOverrides: { colorPrimary: { color: ACCENT } },
    },

    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          background: INK,
          color: PAPER,
          borderRadius: 2,
          "&:hover": { background: "#000", boxShadow: "none" },
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: INK,
          color: PAPER,
          borderRadius: 2,
          fontSize: "0.7rem",
          fontFamily: MONO,
          letterSpacing: "0.04em",
          padding: "4px 8px",
        },
        arrow: { color: INK },
      },
    },

    MuiStepper: {
      styleOverrides: {
        root: {
          "& .MuiStepIcon-root": { color: RULE },
          "& .MuiStepIcon-root.Mui-active": { color: ACCENT },
          "& .MuiStepIcon-root.Mui-completed": { color: OK },
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          background: PAPER,
          color: INK,
          borderBottom: `1px solid ${RULE}`,
          boxShadow: "none",
        },
        colorPrimary: {
          background: PAPER,
          color: INK,
        },
      },
    },

    MuiToolbar: {
      styleOverrides: {
        root: { background: PAPER },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          margin: 0,
          padding: "8px 16px",
          color: INK_SOFT,
          "&:hover": { background: alpha(INK, 0.04), color: INK },
          "&.Mui-selected": {
            background: "transparent",
            color: INK,
            fontWeight: 600,
            "&:hover": { background: alpha(INK, 0.04) },
            "& .MuiListItemIcon-root": { color: ACCENT },
          },
        },
      },
    },

    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontFamily: MONO,
          fontSize: "0.8rem",
          letterSpacing: "0.04em",
        },
      },
    },

    MuiSlider: {
      styleOverrides: {
        root: { color: ACCENT, height: 2 },
        thumb: {
          width: 12,
          height: 12,
          borderRadius: 2,
          "&:hover, &.Mui-active": { boxShadow: "none" },
        },
        track: { border: "none", background: ACCENT, borderRadius: 0 },
        rail: { background: RULE, borderRadius: 0 },
      },
    },

    MuiDivider: {
      styleOverrides: { root: { borderColor: RULE_SOFT } },
    },

    MuiSnackbar: {
      defaultProps: { anchorOrigin: { vertical: "bottom", horizontal: "center" } },
    },

    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        switchBase: {
          "&.Mui-checked": {
            color: ACCENT,
            "& + .MuiSwitch-track": { backgroundColor: ACCENT, opacity: 1 },
          },
        },
        track: { backgroundColor: RULE, opacity: 1, borderRadius: 2 },
        thumb: { borderRadius: 2 },
      },
    },

    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: RULE,
          borderRadius: 0,
          "&.Mui-checked": { color: ACCENT },
        },
      },
    },

    MuiAvatar: {
      styleOverrides: {
        root: {
          background: INK,
          color: PAPER,
          fontFamily: MONO,
          fontWeight: 700,
          letterSpacing: "0.04em",
          borderRadius: 2,
        },
      },
    },
  },
});
