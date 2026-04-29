export const en = {
  common: {
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    open: "Open",
    duplicate: "Duplicate",
    close: "Close",
    loading: "Loading…",
    yes: "Yes",
    no: "No",
    editedBy: "Edited by {{name}}",
  },
  language: {
    label: "Language",
    english: "English",
    french: "Français",
    switchAria: "Switch language",
  },
  contrast: {
    enable: "Enable high-contrast mode",
    disable: "Disable high-contrast mode",
  },
  impersonation: {
    banner: "Viewing as {{email}}",
    expiresIn: "Expires in {{time}}",
    exit: "Exit",
    rowAction: "View as user",
    started: "Now viewing the platform as this user.",
    failed: "Could not start the impersonation session.",
  },
  notifications: {
    title: "Notifications",
    open: "Open notifications",
    empty: "Nothing here yet — alerts about chat, training, and uploads land here.",
    markAllRead: "Mark all read",
    clearAll: "Clear",
    unread_one: "{{count}} unread",
    unread_other: "{{count}} unread",
    chatMessage: "New message in {{pipeline}}",
    mention: "{{user}} mentioned you in {{pipeline}}",
    trainingDone: "Training finished on {{pipeline}}",
    trainingFailed: "Training failed on {{pipeline}}",
    documentIndexed: "Document indexed: {{name}}",
    meetingStarted: "Meeting started on {{pipeline}}",
  },
  rename: {
    open: "Rename",
    placeholder: "New name…",
    save: "Save",
    cancel: "Cancel",
    failed: "Rename failed",
    succeeded: "Renamed",
  },
  documentPreview: {
    open: "Preview indexed chunks",
    title: "Indexed chunks · {{name}}",
    empty: "No chunks indexed yet.",
    chunkLabel: "Chunk #{{index}}",
    charsLabel: "{{count}} chars",
    pageOf: "Page {{page}} of {{total}}",
    failed: "Could not load chunks. Make sure the document finished indexing.",
  },
  feedback: {
    helpful: "Helpful answer",
    notHelpful: "Unhelpful answer",
    thanks: "Thanks for the feedback",
  },
  failedLogins: {
    title: "Failed logins · last 24h",
    total: "{{count}} attempts",
    topIps: "Top offending IPs",
    recent: "Recent attempts",
    noData: "No failed login attempts in the selected window.",
  },
  gdprExport: {
    button: "Export user data",
    inProgress: "Building export…",
    success: "Export downloaded.",
    failed: "Export failed.",
  },
  mentions: {
    placeholderHint: "Type @ to mention a teammate",
  },
  nav: {
    dashboard: "Dashboard",
    datasets: "Datasets",
    pipelines: "Pipelines",
    modelRegistry: "Model Registry",
    collaborator: "Collaborator",
    billing: "Billing",
    profile: "Profile",
    adminPanel: "Admin Panel",
    logout: "Logout",
  },
  dashboard: {
    welcome: "Welcome back, {{name}}",
    overview: "Here's an overview of your workspace",
    stats: {
      datasets: "Datasets",
      ready: "Ready",
      pipelines: "Pipelines",
      trained: "Trained",
    },
    tabs: {
      datasets: "Datasets ({{count}})",
      pipelines: "Pipelines ({{count}})",
    },
    actions: {
      newDataset: "+ New Dataset",
      newPipeline: "+ New Pipeline",
    },
    workspaceFilter: {
      personal: "Personal",
      company: "Company",
    },
    pipelineCard: {
      nodeCount: "{{count}} nodes",
    },
  },
  stamps: {
    editedByYou: "Edited by you · {{when}}",
    editedByOther: "Edited · {{when}}",
  },
  preprocessingSuggestions: {
    title: "Profiler suggestions",
    dismissAria: "Dismiss this suggestion",
    highMissing:
      "High missing values in {{column}} ({{pct}}%) — consider Imputation.",
    highSkew: "High skew in {{column}} (γ₁ = {{value}}) — consider a Log transform.",
    needsLogTransform: "Profiler flagged {{column}} for a Log transform.",
    highCardinality:
      "{{column}} has {{unique}} unique values — drop or label-encode it before one-hot.",
  },
  emptyStates: {
    datasets: {
      title: "No datasets yet",
      description:
        "Drop a CSV here to start, or pick a demo dataset to run a full pipeline in seconds.",
      action: "Upload your first CSV",
    },
    pipelines: {
      title: "No pipelines yet",
      description:
        "Pipelines wire your datasets to a training step. Create one to start visualizing your workflow.",
      action: "Create your first pipeline",
    },
    models: {
      title: "No trained models yet",
      description:
        "Run a pipeline to register a model here. Trained versions show up automatically with metrics and download links.",
      action: "Open the pipelines",
    },
    chat: {
      title: "Ready to chat",
      description:
        "Index a document with the Document node, then ask a question grounded entirely in your local corpus.",
    },
  },
  setupChecklist: {
    title: "Get started",
    subtitle: "Complete these steps to launch your first AI workflow",
    completedTitle: "All set!",
    completedSubtitle: "You've completed the onboarding checklist.",
    dismiss: "Dismiss",
    items: {
      uploadDataset: "Upload your first dataset",
      uploadDatasetHint: "Bring a CSV or pick a demo dataset to get started.",
      buildPipeline: "Build a pipeline",
      buildPipelineHint: "Drag a Dataset node onto the canvas and connect a Train step.",
      runTraining: "Run a training job",
      runTrainingHint: "Click Run on your pipeline and watch the live training chart.",
      inviteTeammate: "Invite a teammate (optional)",
      inviteTeammateHint: "Bring collaborators into your company workspace from the Collaborator page.",
    },
  },
  demoDatasets: {
    buttonLabel: "Load demo dataset",
    menuAriaLabel: "Pick a demo dataset to load",
    summaryHeader: "Dataset summary",
    queued: "Queued…",
    profiling: "Profiling…",
    profilingShort: "Profiling…",
    loading: "Loading…",
    loadButton: "Load demo",
    successRedirect: "Demo dataset ready. Redirecting…",
    churn: {
      title: "Customer Churn — Demo Dataset",
      summary: "100 rows · binary churn label · classification",
      description:
        "A small, pre-cleaned sample of telecom customer records with a binary churn label. Perfect for a first end-to-end pipeline.",
      specs:
        "100 rows · 11 columns · Target: churn (binary)\nFeatures: tenure, monthly_charges, contract type, payment method, support_calls…",
    },
    iris: {
      title: "Iris — Classic Demo",
      summary: "150 rows · 3-class species · classification",
      description:
        "The classic Fisher iris dataset. Three balanced species classes from four numeric flower measurements — the canonical hello-world for classification.",
      specs:
        "150 rows · 5 columns · Target: species (3 classes)\nFeatures: sepal_length, sepal_width, petal_length, petal_width",
    },
    titanic: {
      title: "Titanic — Survival Demo",
      summary: "100 rows · binary survival · classification",
      description:
        "A 100-row sample of the Titanic survival dataset. Mix of numeric and categorical features with realistic missing values — good for trying preprocessing.",
      specs:
        "100 rows · 9 columns · Target: survived (binary)\nFeatures: pclass, sex, age, sibsp, parch, fare, embarked",
    },
    errors: {
      fileTooLarge: "The demo file exceeds the {{max}} MB limit for your plan.",
      quotaReached: "You've reached the {{max}} dataset limit on your plan.",
      loadFailed: "Failed to load demo dataset",
    },
  },
  pipelineCanvas: {
    mode: {
      ml: "Traditional ML",
      rag: "Generative AI",
      lockedHint: "Clear the canvas to switch pipeline mode.",
    },
    addNode: {
      dataset: "Dataset",
      train: "Train",
      evaluate: "Evaluate",
      document: "Document",
      vectorStore: "Vector Store",
      ragConfig: "RAG Config",
    },
    actions: {
      templates: "Templates",
      templatesAria: "Insert a starter pipeline template",
      autoLayout: "Auto-Layout",
      autoLayoutTooltip: "Auto-arrange nodes left-to-right",
      autoLayoutAria: "Auto-arrange pipeline nodes",
      undo: "Undo (⌘Z)",
      redo: "Redo (⌘⇧Z)",
      deleteNode: "Delete selected node (Del)",
      minimapShow: "Show minimap",
      minimapHide: "Hide minimap",
      minimapAria: "Toggle minimap visibility",
      chat: "Chat",
      save: "Save",
      run: "Run",
      running: "Running…",
    },
    presets: {
      mlStarter: {
        label: "ML starter",
        description: "Dataset → Train (XGBoost) → Evaluate, pre-wired.",
      },
      ragStarter: {
        label: "RAG starter",
        description: "Document → Vector Store → RAG Config, pre-wired.",
      },
      inserted: "Template inserted — Auto-Layout applied.",
    },
    progress: {
      training: "Training… {{pct}}%",
    },
    status: {
      trainFailed: "Training failed: {{error}}",
      trainSuccess: "Training complete! Click the Evaluate node to see metrics.",
      saved: "Pipeline saved",
      saveFailed: "Save failed",
      missingNodes: "Add both a Dataset and Train node first",
      runFailed: "Failed to start training",
    },
  },
  chat: {
    title: "RAG Chat",
    subtitle: "Local LLM + your documents · streamed token-by-token",
    placeholder: "Ask a question about your documents…",
    send: "Send",
    sendAria: "Send message",
    emptyAlert: "Ask a question about the documents you've ingested. The model will only answer from your indexed context.",
    sources_one: "{{count}} source used",
    sources_other: "{{count}} sources used",
    thinking: "Thinking locally…",
    error: "Chat failed. Please retry.",
    documentFallback: "document",
    chunkScore: "chunk #{{index}} · score {{score}}",
    threads: {
      title: "Conversations",
      newButton: "New chat",
      empty: "No conversations yet — start one to see it here.",
      draftLabel: "Untitled (new)",
      turnCount_one: "{{count}} turn",
      turnCount_other: "{{count}} turns",
      deleteAria: "Delete this thread",
      collapseAria: "Hide thread sidebar",
      expandAria: "Show thread sidebar",
    },
  },
};

export type TranslationKeys = typeof en;
