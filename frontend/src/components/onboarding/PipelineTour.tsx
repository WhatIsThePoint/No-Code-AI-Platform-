import { useEffect, useState } from "react";
import Joyride, { STATUS, type CallBackProps, type Step } from "react-joyride";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authSlice";

const STEPS: Step[] = [
  {
    target: '[data-tour="stepper"]',
    title: "Your MLOps roadmap",
    content:
      "This stepper tracks where you are in the ML lifecycle — from picking data to evaluating your model. It updates automatically as you work.",
    disableBeacon: true,
    placement: "bottom",
  },
  {
    target: '[data-tour="add-dataset"]',
    title: "Step 1 — Pick a dataset",
    content:
      "Click here to drop a Dataset node onto the canvas. You'll choose which uploaded dataset powers this pipeline.",
    placement: "bottom",
  },
  {
    target: '[data-tour="add-train"]',
    title: "Step 2 — Choose an algorithm",
    content:
      "Drop a Train node to pick an algorithm (XGBoost, Random Forest, Ridge, …) and set the target column.",
    placement: "bottom",
  },
  {
    target: '[data-tour="add-evaluate"]',
    title: "Step 3 — Wire the evaluation",
    content:
      "Finally, drop an Evaluate node. Drag edges between Dataset → Train → Evaluate to finish the pipeline.",
    placement: "bottom",
  },
  {
    target: '[data-tour="run-pipeline"]',
    title: "Hit Run",
    content:
      "When your pipeline is wired up, press Run. Training progresses live above the canvas and results land on the Evaluate node.",
    placement: "bottom",
  },
];

interface Props {
  shouldStart: boolean;
}

export function PipelineTour({ shouldStart }: Props) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (shouldStart && user && !user.has_seen_pipeline_tour) {
      const t = setTimeout(() => setRun(true), 400);
      return () => clearTimeout(t);
    }
  }, [shouldStart, user]);

  const handleCallback = async (data: CallBackProps) => {
    const { status } = data;
    const finished: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finished.includes(status)) {
      setRun(false);
      if (user && accessToken && !user.has_seen_pipeline_tour) {
        try {
          const { data: updated } = await authApi.updateMe({ has_seen_pipeline_tour: true });
          setAuth(updated, accessToken);
        } catch {
          setAuth({ ...user, has_seen_pipeline_tour: true }, accessToken);
        }
      }
    }
  };

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      showSkipButton
      showProgress
      disableScrolling
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: "#d2541c",
          zIndex: 2000,
          arrowColor: "#ffffff",
          backgroundColor: "#ffffff",
          textColor: "#0f172a",
        },
        tooltipContainer: { textAlign: "left" },
        buttonNext: { background: "linear-gradient(135deg, #d2541c, #8b5cf6)" },
      }}
    />
  );
}
