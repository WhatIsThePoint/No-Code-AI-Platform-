import { createTheme, alpha } from "@mui/material/styles";

const INDIGO = "#6366f1";
const INDIGO_DARK = "#4f46e5";
const PURPLE = "#8b5cf6";
const SLATE_50 = "#f8fafc";
const SLATE_100 = "#f1f5f9";
const SLATE_200 = "#e2e8f0";
const SLATE_700 = "#334155";
const SLATE_800 = "#1e293b";
const SLATE_900 = "#0f172a";

export const theme = createTheme({
  palette: {
    primary: {
      main: INDIGO,
      dark: INDIGO_DARK,
      light: "#818cf8",
      contrastText: "#ffffff",
    },
    secondary: {
      main: PURPLE,
      dark: "#7c3aed",
      light: "#a78bfa",
      contrastText: "#ffffff",
    },
    success: {
      main: "#10b981",
      dark: "#059669",
      light: "#34d399",
    },
    warning: {
      main: "#f59e0b",
      dark: "#d97706",
      light: "#fbbf24",
    },
    error: {
      main: "#ef4444",
      dark: "#dc2626",
      light: "#f87171",
    },
    info: {
      main: "#3b82f6",
      dark: "#2563eb",
      light: "#60a5fa",
    },
    background: {
      default: SLATE_50,
      paper: "#ffffff",
    },
    text: {
      primary: SLATE_800,
      secondary: SLATE_700,
    },
    divider: SLATE_200,
  },

  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h1: { fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1 },
    h2: { fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.2 },
    h3: { fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 },
    h4: { fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.3 },
    h5: { fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.4 },
    h6: { fontWeight: 600, lineHeight: 1.4 },
    subtitle1: { fontWeight: 600, lineHeight: 1.5 },
    subtitle2: { fontWeight: 600, fontSize: "0.8125rem", lineHeight: 1.5, letterSpacing: "0.02em", textTransform: "uppercase" as const, color: SLATE_700 },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.6, color: SLATE_700 },
    caption: { lineHeight: 1.5, color: SLATE_700 },
    button: { fontWeight: 600, letterSpacing: "0.01em" },
  },

  shape: {
    borderRadius: 12,
  },

  shadows: [
    "none",
    `0 1px 2px 0 ${alpha(SLATE_900, 0.05)}`,
    `0 1px 3px 0 ${alpha(SLATE_900, 0.08)}, 0 1px 2px -1px ${alpha(SLATE_900, 0.08)}`,
    `0 4px 6px -1px ${alpha(SLATE_900, 0.08)}, 0 2px 4px -2px ${alpha(SLATE_900, 0.06)}`,
    `0 10px 15px -3px ${alpha(SLATE_900, 0.08)}, 0 4px 6px -4px ${alpha(SLATE_900, 0.06)}`,
    `0 20px 25px -5px ${alpha(SLATE_900, 0.08)}, 0 8px 10px -6px ${alpha(SLATE_900, 0.06)}`,
    `0 25px 50px -12px ${alpha(SLATE_900, 0.2)}`,
    ...Array(18).fill("none"),
  ] as unknown as import("@mui/material/styles").Shadows,

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: SLATE_50,
        },
      },
    },

    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: "none" as const,
          fontWeight: 600,
          padding: "8px 20px",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            transform: "translateY(-1px)",
          },
          "&:active": {
            transform: "translateY(0)",
          },
        },
        contained: {
          boxShadow: `0 1px 3px 0 ${alpha(SLATE_900, 0.12)}, 0 1px 2px -1px ${alpha(SLATE_900, 0.08)}`,
          "&:hover": {
            boxShadow: `0 4px 12px 0 ${alpha(INDIGO, 0.35)}`,
          },
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${INDIGO} 0%, ${INDIGO_DARK} 100%)`,
          "&:hover": {
            background: `linear-gradient(135deg, ${INDIGO_DARK} 0%, #4338ca 100%)`,
          },
        },
        outlined: {
          borderWidth: "1.5px",
          "&:hover": {
            borderWidth: "1.5px",
            backgroundColor: alpha(INDIGO, 0.04),
          },
        },
        sizeSmall: {
          padding: "5px 14px",
          fontSize: "0.8125rem",
          borderRadius: 8,
        },
      },
    },

    MuiCard: {
      defaultProps: {
        variant: "outlined",
      },
      styleOverrides: {
        root: {
          borderRadius: 16,
          borderColor: SLATE_200,
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            borderColor: alpha(INDIGO, 0.3),
            boxShadow: `0 8px 25px -5px ${alpha(SLATE_900, 0.08)}, 0 0 0 1px ${alpha(INDIGO, 0.1)}`,
            transform: "translateY(-2px)",
          },
        },
      },
    },

    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: `1px solid ${SLATE_200}`,
          backgroundImage: "none",
        },
        elevation0: {
          boxShadow: "none",
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          fontSize: "0.75rem",
          letterSpacing: "0.01em",
        },
        colorPrimary: {
          backgroundColor: alpha(INDIGO, 0.1),
          color: INDIGO_DARK,
          "&:hover": {
            backgroundColor: alpha(INDIGO, 0.18),
          },
        },
        colorSuccess: {
          backgroundColor: alpha("#10b981", 0.1),
          color: "#059669",
        },
        colorWarning: {
          backgroundColor: alpha("#f59e0b", 0.1),
          color: "#b45309",
        },
        colorError: {
          backgroundColor: alpha("#ef4444", 0.1),
          color: "#dc2626",
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        size: "medium",
      },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 10,
            transition: "all 0.2s ease",
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(INDIGO, 0.4),
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderWidth: 2,
              borderColor: INDIGO,
              boxShadow: `0 0 0 3px ${alpha(INDIGO, 0.12)}`,
            },
          },
        },
      },
    },

    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          border: "none",
          boxShadow: `0 25px 50px -12px ${alpha(SLATE_900, 0.25)}`,
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          border: "none",
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none" as const,
          fontWeight: 600,
          fontSize: "0.875rem",
          minHeight: 44,
          borderRadius: "10px 10px 0 0",
          transition: "all 0.2s ease",
          "&.Mui-selected": {
            color: INDIGO_DARK,
          },
          "&:hover": {
            backgroundColor: alpha(INDIGO, 0.04),
          },
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: "3px 3px 0 0",
          background: `linear-gradient(90deg, ${INDIGO}, ${PURPLE})`,
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: "background-color 0.15s ease",
          "&:nth-of-type(even)": {
            backgroundColor: alpha(SLATE_100, 0.5),
          },
          "&:hover": {
            backgroundColor: `${alpha(INDIGO, 0.04)} !important`,
          },
        },
        head: {
          backgroundColor: `${SLATE_100} !important`,
          "&:hover": {
            backgroundColor: `${SLATE_100} !important`,
          },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${SLATE_200}`,
          padding: "12px 16px",
        },
        head: {
          fontWeight: 700,
          fontSize: "0.75rem",
          letterSpacing: "0.05em",
          textTransform: "uppercase" as const,
          color: SLATE_700,
          backgroundColor: SLATE_100,
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontWeight: 500,
          border: "none",
        },
        standardSuccess: {
          backgroundColor: alpha("#10b981", 0.08),
          color: "#065f46",
        },
        standardError: {
          backgroundColor: alpha("#ef4444", 0.08),
          color: "#991b1b",
        },
        standardWarning: {
          backgroundColor: alpha("#f59e0b", 0.08),
          color: "#92400e",
        },
        standardInfo: {
          backgroundColor: alpha(INDIGO, 0.08),
          color: INDIGO_DARK,
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 99,
          height: 6,
          backgroundColor: SLATE_200,
        },
        bar: {
          borderRadius: 99,
          background: `linear-gradient(90deg, ${INDIGO}, ${PURPLE})`,
        },
      },
    },

    MuiCircularProgress: {
      styleOverrides: {
        colorPrimary: {
          color: INDIGO,
        },
      },
    },

    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: `0 8px 25px -5px ${alpha(INDIGO, 0.4)}`,
          background: `linear-gradient(135deg, ${INDIGO} 0%, ${INDIGO_DARK} 100%)`,
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            background: `linear-gradient(135deg, ${INDIGO_DARK} 0%, #4338ca 100%)`,
            transform: "translateY(-2px) scale(1.05)",
            boxShadow: `0 12px 35px -5px ${alpha(INDIGO, 0.5)}`,
          },
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: SLATE_900,
          borderRadius: 8,
          fontSize: "0.75rem",
          fontWeight: 500,
          padding: "6px 12px",
        },
        arrow: {
          color: SLATE_900,
        },
      },
    },

    MuiStepper: {
      styleOverrides: {
        root: {
          "& .MuiStepIcon-root.Mui-active": {
            color: INDIGO,
          },
          "& .MuiStepIcon-root.Mui-completed": {
            color: "#10b981",
          },
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          background: `linear-gradient(135deg, ${SLATE_900} 0%, ${alpha(INDIGO_DARK, 0.95)} 100%)`,
          backdropFilter: "blur(12px)",
          borderBottom: "none",
          boxShadow: `0 1px 3px 0 ${alpha(SLATE_900, 0.12)}`,
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          margin: "2px 8px",
          padding: "8px 12px",
          transition: "all 0.2s ease",
          "&:hover": {
            backgroundColor: alpha(INDIGO, 0.06),
          },
          "&.Mui-selected": {
            backgroundColor: alpha(INDIGO, 0.1),
            color: INDIGO_DARK,
            fontWeight: 600,
            "&:hover": {
              backgroundColor: alpha(INDIGO, 0.14),
            },
            "& .MuiListItemIcon-root": {
              color: INDIGO_DARK,
            },
          },
        },
      },
    },

    MuiSlider: {
      styleOverrides: {
        root: {
          color: INDIGO,
          height: 6,
        },
        thumb: {
          width: 16,
          height: 16,
          "&:hover, &.Mui-active": {
            boxShadow: `0 0 0 6px ${alpha(INDIGO, 0.16)}`,
          },
        },
        track: {
          border: "none",
          background: `linear-gradient(90deg, ${INDIGO}, ${PURPLE})`,
        },
      },
    },

    MuiSnackbar: {
      defaultProps: {
        anchorOrigin: { vertical: "bottom", horizontal: "center" },
      },
    },
  },
});
