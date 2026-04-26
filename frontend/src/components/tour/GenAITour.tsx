import { useEffect, useState } from "react";
import Joyride, { STATUS, type CallBackProps, type Step } from "react-joyride";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authSlice";

const STEPS: Step[] = [
  {
    target: '[data-tour="canvas-mode"]',
    title: "Welcome to the GenAI workspace",
    content:
      "You're now in RAG mode. Build a chatbot that answers strictly from your own documents — fully local, no cloud LLMs.",
    disableBeacon: true,
    placement: "bottom",
  },
  {
    target: '[data-tour="add-document"]',
    title: "Step 1 — Add a Document",
    content:
      "Drop a Document node and upload a PDF, TXT, or Markdown file. We'll chunk and embed it locally with sentence-transformers.",
    placement: "bottom",
  },
  {
    target: '[data-tour="add-vector-store"]',
    title: "Step 2 — Connect a Vector Store",
    content:
      "Add the pgvector node — every chunk becomes a 384-dim embedding indexed for cosine similarity search.",
    placement: "bottom",
  },
  {
    target: '[data-tour="add-rag-config"]',
    title: "Step 3 — Pick your local LLM",
    content:
      "Drop a RAG Config node to choose which Ollama model answers your questions. Llama 3.2 3B is the default.",
    placement: "bottom",
  },
  {
    target: '[data-tour="rag-chat"]',
    title: "Step 4 — Test your chatbot",
    content:
      "Ask questions in this panel. The model only answers from the documents you indexed and cites its sources for every reply.",
    placement: "top",
  },
];

interface Props {
  shouldStart: boolean;
}

export function GenAITour({ shouldStart }: Props) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (shouldStart && user && !user.has_seen_genai_tour) {
      const t = setTimeout(() => setRun(true), 400);
      return () => clearTimeout(t);
    }
  }, [shouldStart, user]);

  const handleCallback = async (data: CallBackProps) => {
    const { status } = data;
    const finished: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finished.includes(status)) {
      setRun(false);
      if (user && accessToken && !user.has_seen_genai_tour) {
        try {
          const { data: updated } = await authApi.updateMe({ has_seen_genai_tour: true });
          setAuth(updated, accessToken);
        } catch {
          setAuth({ ...user, has_seen_genai_tour: true }, accessToken);
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
          primaryColor: "#f59e0b",
          zIndex: 2000,
          arrowColor: "#ffffff",
          backgroundColor: "#ffffff",
          textColor: "#0f172a",
        },
        tooltipContainer: { textAlign: "left" },
        buttonNext: { background: "linear-gradient(135deg, #f59e0b, #d97706)" },
      }}
    />
  );
}
