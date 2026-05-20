import { Box, Step, StepLabel, Stepper, Typography, alpha } from "@mui/material";
import StorageIcon from "@mui/icons-material/StorageRounded";
import TuneIcon from "@mui/icons-material/TuneRounded";
import AccountTreeIcon from "@mui/icons-material/AccountTreeRounded";
import ModelTrainingIcon from "@mui/icons-material/ModelTrainingRounded";
import AssessmentIcon from "@mui/icons-material/AssessmentRounded";
import type { PipelineStep } from "./derivePipelineStep";

const STEPS = [
  { label: "Data Intake", hint: "Pick a dataset to work with", icon: StorageIcon },
  { label: "Preprocessing", hint: "Clean and split the data", icon: TuneIcon },
  { label: "Architecture", hint: "Wire dataset to a model", icon: AccountTreeIcon },
  { label: "Training", hint: "Run the pipeline", icon: ModelTrainingIcon },
  { label: "Evaluation", hint: "Review metrics", icon: AssessmentIcon },
] as const;

interface Props {
  activeStep: PipelineStep;
  completedSteps: Set<number>;
}

export function PipelineStepper({ activeStep, completedSteps }: Props) {
  return (
    <Box
      data-tour="stepper"
      sx={{
        px: 3,
        py: 1.75,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: alpha("#f8fafc", 0.9),
        backdropFilter: "blur(10px)",
      }}
    >
      <Stepper
        activeStep={activeStep}
        alternativeLabel
        sx={{
          "& .MuiStepLabel-label": { fontSize: "0.72rem", fontWeight: 600, mt: 0.5 },
          "& .MuiStepIcon-root": { fontSize: 24 },
          "& .MuiStepIcon-root.Mui-active": { color: "#d2541c" },
          "& .MuiStepIcon-root.Mui-completed": { color: "#10b981" },
        }}
      >
        {STEPS.map((s, i) => (
          <Step key={s.label} completed={completedSteps.has(i)}>
            <StepLabel
              icon={
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                      i === activeStep
                        ? "linear-gradient(135deg, #d2541c, #8b5cf6)"
                        : completedSteps.has(i)
                        ? "linear-gradient(135deg, #10b981, #059669)"
                        : alpha("#94a3b8", 0.12),
                    color: i === activeStep || completedSteps.has(i) ? "#fff" : "#64748b",
                    transition: "all 0.25s ease",
                  }}
                >
                  <s.icon sx={{ fontSize: 15 }} />
                </Box>
              }
            >
              {s.label}
              {i === activeStep && (
                <Typography
                  variant="caption"
                  sx={{ display: "block", color: "text.secondary", fontWeight: 500, fontSize: "0.65rem" }}
                >
                  {s.hint}
                </Typography>
              )}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
