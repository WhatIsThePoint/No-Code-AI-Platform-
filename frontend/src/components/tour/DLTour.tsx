import { useEffect, useState } from "react";
import Joyride, { STATUS, type CallBackProps, type Step } from "react-joyride";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authSlice";

const STEPS: Step[] = [
  {
    target: '[data-tour="canvas-mode"]',
    title: "Welcome to the Deep Learning workspace",
    content:
      "You're now in DL mode. Build an image-classification model end-to-end — fully local, trained on your own dataset.",
    disableBeacon: true,
    placement: "bottom",
  },
  {
    target: '[data-tour="add-image-dataset"]',
    title: "Step 1 — Add an Image Dataset",
    content:
      "Drop an Image Dataset node and upload a folder of labelled images. Each subfolder name becomes a class.",
    placement: "bottom",
  },
  {
    target: '[data-tour="add-cnn-arch"]',
    title: "Step 2 — Pick a CNN architecture",
    content:
      "Choose the model topology — a tiny CNN for a fast demo, or ResNet-style for harder datasets. You can also tweak input size and depth.",
    placement: "bottom",
  },
  {
    target: '[data-tour="add-dl-train"]',
    title: "Step 3 — Configure training",
    content:
      "Drop a DL Train node to set epochs, batch size, learning rate, and the optimiser. Limits are clamped to what your hardware can run.",
    placement: "bottom",
  },
  {
    target: '[data-tour="run-pipeline"]',
    title: "Step 4 — Hit Run",
    content:
      "Wire Image Dataset → CNN Arch → DL Train, then press Run. When training finishes, the DL Train node lights up with final loss, top-1 accuracy, and a sample-predictions strip.",
    placement: "bottom",
  },
];

interface Props {
  shouldStart: boolean;
}

export function DLTour({ shouldStart }: Props) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (shouldStart && user && !user.has_seen_dl_tour) {
      const t = setTimeout(() => setRun(true), 400);
      return () => clearTimeout(t);
    }
  }, [shouldStart, user]);

  const handleCallback = async (data: CallBackProps) => {
    const { status } = data;
    const finished: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finished.includes(status)) {
      setRun(false);
      if (user && accessToken && !user.has_seen_dl_tour) {
        try {
          const { data: updated } = await authApi.updateMe({ has_seen_dl_tour: true });
          setAuth(updated, accessToken);
        } catch {
          setAuth({ ...user, has_seen_dl_tour: true }, accessToken);
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
          primaryColor: "#0ea5e9",
          zIndex: 2000,
          arrowColor: "#ffffff",
          backgroundColor: "#ffffff",
          textColor: "#0f172a",
        },
        tooltipContainer: { textAlign: "left" },
        buttonNext: { background: "linear-gradient(135deg, #0ea5e9, #7e22ce)" },
      }}
    />
  );
}
