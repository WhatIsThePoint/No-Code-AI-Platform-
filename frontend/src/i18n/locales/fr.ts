import type { TranslationKeys } from "./en";

export const fr: TranslationKeys = {
  common: {
    cancel: "Annuler",
    save: "Enregistrer",
    delete: "Supprimer",
    open: "Ouvrir",
    duplicate: "Dupliquer",
    close: "Fermer",
    loading: "Chargement…",
    yes: "Oui",
    no: "Non",
    editedBy: "Modifié par {{name}}",
  },
  language: {
    label: "Langue",
    english: "English",
    french: "Français",
    switchAria: "Changer de langue",
  },
  contrast: {
    enable: "Activer le mode contraste élevé",
    disable: "Désactiver le mode contraste élevé",
  },
  impersonation: {
    banner: "Connecté en tant que {{email}}",
    expiresIn: "Expire dans {{time}}",
    exit: "Quitter",
    rowAction: "Voir en tant qu'utilisateur",
    started: "Vous voyez maintenant la plateforme telle que cet utilisateur.",
    failed: "Impossible de démarrer la session d'usurpation.",
  },
  notifications: {
    title: "Notifications",
    open: "Ouvrir les notifications",
    empty: "Rien pour l'instant — les alertes de discussion, d'entraînement et d'import s'afficheront ici.",
    markAllRead: "Tout marquer lu",
    clearAll: "Vider",
    unread_one: "{{count}} non lue",
    unread_other: "{{count}} non lues",
    chatMessage: "Nouveau message dans {{pipeline}}",
    mention: "{{user}} vous a mentionné dans {{pipeline}}",
    trainingDone: "Entraînement terminé sur {{pipeline}}",
    trainingFailed: "Échec de l'entraînement sur {{pipeline}}",
    documentIndexed: "Document indexé : {{name}}",
    meetingStarted: "Réunion démarrée sur {{pipeline}}",
  },
  rename: {
    open: "Renommer",
    placeholder: "Nouveau nom…",
    save: "Enregistrer",
    cancel: "Annuler",
    failed: "Échec du renommage",
    succeeded: "Renommé",
  },
  documentPreview: {
    open: "Aperçu des fragments indexés",
    title: "Fragments indexés · {{name}}",
    empty: "Aucun fragment indexé pour le moment.",
    chunkLabel: "Fragment n°{{index}}",
    charsLabel: "{{count}} car.",
    pageOf: "Page {{page}} sur {{total}}",
    failed: "Impossible de charger les fragments. Vérifiez que l'indexation est terminée.",
  },
  feedback: {
    helpful: "Réponse utile",
    notHelpful: "Réponse peu utile",
    thanks: "Merci pour le retour",
  },
  failedLogins: {
    title: "Connexions échouées · 24 dernières heures",
    total: "{{count}} tentatives",
    topIps: "IPs les plus fréquentes",
    recent: "Tentatives récentes",
    noData: "Aucune tentative de connexion échouée sur la période choisie.",
  },
  gdprExport: {
    button: "Exporter les données",
    inProgress: "Préparation de l'export…",
    success: "Export téléchargé.",
    failed: "Échec de l'export.",
  },
  mentions: {
    placeholderHint: "Tapez @ pour mentionner un coéquipier",
  },
  nav: {
    dashboard: "Tableau de bord",
    datasets: "Jeux de données",
    pipelines: "Pipelines",
    modelRegistry: "Registre de modèles",
    collaborator: "Collaboration",
    billing: "Facturation",
    profile: "Profil",
    adminPanel: "Administration",
    logout: "Déconnexion",
  },
  dashboard: {
    welcome: "Bon retour, {{name}}",
    overview: "Voici un aperçu de votre espace de travail",
    stats: {
      datasets: "Jeux de données",
      ready: "Prêts",
      pipelines: "Pipelines",
      trained: "Entraînés",
    },
    tabs: {
      datasets: "Jeux de données ({{count}})",
      pipelines: "Pipelines ({{count}})",
    },
    actions: {
      newDataset: "+ Nouveau jeu de données",
      newPipeline: "+ Nouveau pipeline",
    },
    workspaceFilter: {
      personal: "Personnel",
      company: "Entreprise",
    },
    pipelineCard: {
      nodeCount: "{{count}} nœuds",
    },
  },
  stamps: {
    editedByYou: "Modifié par vous · {{when}}",
    editedByOther: "Modifié · {{when}}",
  },
  preprocessingSuggestions: {
    title: "Suggestions du profileur",
    dismissAria: "Ignorer cette suggestion",
    highMissing:
      "Beaucoup de valeurs manquantes dans {{column}} ({{pct}} %) — pensez à l'imputation.",
    highSkew:
      "Forte asymétrie dans {{column}} (γ₁ = {{value}}) — envisagez une transformation logarithmique.",
    needsLogTransform:
      "Le profileur recommande une transformation logarithmique pour {{column}}.",
    highCardinality:
      "{{column}} a {{unique}} valeurs uniques — retirez-la ou utilisez un encodage label avant le one-hot.",
  },
  emptyStates: {
    datasets: {
      title: "Aucun jeu de données pour le moment",
      description:
        "Déposez un CSV ici pour commencer, ou choisissez un jeu de démonstration pour lancer un pipeline complet en quelques secondes.",
      action: "Importer votre premier CSV",
    },
    pipelines: {
      title: "Aucun pipeline pour le moment",
      description:
        "Les pipelines relient vos jeux de données à une étape d'entraînement. Créez-en un pour visualiser votre flux de travail.",
      action: "Créer votre premier pipeline",
    },
    models: {
      title: "Aucun modèle entraîné",
      description:
        "Exécutez un pipeline pour y enregistrer un modèle. Les versions entraînées apparaissent ici avec leurs métriques et un lien de téléchargement.",
      action: "Ouvrir les pipelines",
    },
    chat: {
      title: "Prêt à discuter",
      description:
        "Indexez un document avec le nœud Document, puis posez une question fondée uniquement sur votre corpus local.",
    },
  },
  setupChecklist: {
    title: "Premiers pas",
    subtitle: "Complétez ces étapes pour lancer votre premier flux IA",
    completedTitle: "Tout est prêt !",
    completedSubtitle: "Vous avez terminé la liste de démarrage.",
    dismiss: "Masquer",
    items: {
      uploadDataset: "Importer un premier jeu de données",
      uploadDatasetHint: "Apportez un CSV ou choisissez un jeu de démonstration pour commencer.",
      buildPipeline: "Construire un pipeline",
      buildPipelineHint: "Glissez un nœud Jeu de données sur le canevas et reliez-le à une étape d'entraînement.",
      runTraining: "Lancer un entraînement",
      runTrainingHint: "Cliquez sur Exécuter — les résultats apparaîtront sur le nœud Évaluer à la fin de l'entraînement.",
      inviteTeammate: "Inviter un coéquipier (optionnel)",
      inviteTeammateHint: "Ajoutez des collaborateurs à votre espace entreprise depuis la page Collaboration.",
    },
  },
  demoDatasets: {
    buttonLabel: "Charger un jeu de démo",
    menuAriaLabel: "Choisir un jeu de démonstration à charger",
    summaryHeader: "Résumé du jeu de données",
    queued: "En file d'attente…",
    profiling: "Profilage…",
    profilingShort: "Profilage…",
    loading: "Chargement…",
    loadButton: "Charger la démo",
    successRedirect: "Jeu de démo prêt. Redirection…",
    churn: {
      title: "Désabonnement client — Démo",
      summary: "100 lignes · libellé binaire · classification",
      description:
        "Un petit échantillon nettoyé de clients télécom avec un libellé binaire de désabonnement. Idéal pour un premier pipeline complet.",
      specs:
        "100 lignes · 11 colonnes · Cible : churn (binaire)\nVariables : tenure, monthly_charges, type de contrat, mode de paiement, support_calls…",
    },
    iris: {
      title: "Iris — Démo classique",
      summary: "150 lignes · 3 classes · classification",
      description:
        "Le célèbre jeu d'iris de Fisher. Trois classes équilibrées à partir de quatre mesures florales numériques — le hello-world canonique de la classification.",
      specs:
        "150 lignes · 5 colonnes · Cible : species (3 classes)\nVariables : sepal_length, sepal_width, petal_length, petal_width",
    },
    titanic: {
      title: "Titanic — Démo de survie",
      summary: "100 lignes · survie binaire · classification",
      description:
        "Un échantillon de 100 lignes du jeu Titanic. Mélange de variables numériques et catégorielles avec des valeurs manquantes réalistes — parfait pour tester le prétraitement.",
      specs:
        "100 lignes · 9 colonnes · Cible : survived (binaire)\nVariables : pclass, sex, age, sibsp, parch, fare, embarked",
    },
    attritionDirty: {
      title: "Attrition employés — Démo « sale »",
      summary: "90 lignes · attrition binaire · met en valeur le prétraitement",
      description:
        "Un jeu RH volontairement bruité pour exercer le pipeline de prétraitement : environ 12 % de valeurs manquantes sur plusieurs colonnes, casse incohérente des catégories (« Engineering » vs « engineering » vs « ENGINEERING »), encodages oui/non hétérogènes (« Yes », « Y », « 1 », « N/A », « ? ») et quelques valeurs aberrantes (salaire, heures supplémentaires).",
      specs:
        "90 lignes · 10 colonnes · Cible : attrition (binaire)\nVariables : age, department, years_at_company, monthly_salary, overtime_hours, satisfaction, remote_days_per_week, has_promotion\nProblèmes semés : valeurs manquantes, casse incohérente, valeurs aberrantes, encodages booléens mixtes",
    },
    errors: {
      fileTooLarge: "Le fichier de démo dépasse la limite de {{max}} Mo de votre formule.",
      quotaReached: "Vous avez atteint la limite de {{max}} jeux de données de votre formule.",
      loadFailed: "Échec du chargement du jeu de démonstration",
    },
  },
  pipelineCanvas: {
    mode: {
      ml: "ML traditionnel",
      rag: "IA générative",
      dl: "Apprentissage profond",
      lockedHint: "Videz le canevas pour changer de mode.",
    },
    addNode: {
      dataset: "Jeu de données",
      train: "Entraîner",
      evaluate: "Évaluer",
      document: "Document",
      vectorStore: "Base vectorielle",
      ragConfig: "Config RAG",
      imageDataset: "Jeu d'images",
      cnnArch: "Architecture CNN",
      dlTrain: "Entraînement DL",
    },
    actions: {
      templates: "Modèles",
      templatesAria: "Insérer un modèle de pipeline de démarrage",
      autoLayout: "Disposition auto",
      autoLayoutTooltip: "Réorganiser les nœuds de gauche à droite",
      autoLayoutAria: "Réorganiser automatiquement les nœuds du pipeline",
      undo: "Annuler (⌘Z)",
      redo: "Rétablir (⌘⇧Z)",
      deleteNode: "Supprimer le nœud sélectionné (Suppr)",
      minimapShow: "Afficher la mini-carte",
      minimapHide: "Masquer la mini-carte",
      minimapAria: "Basculer la mini-carte",
      chat: "Discussion",
      save: "Enregistrer",
      run: "Exécuter",
      running: "Exécution…",
    },
    presets: {
      mlStarter: {
        label: "Démarrage ML",
        description: "Jeu de données → Entraînement (XGBoost) → Évaluation, déjà reliés.",
      },
      ragStarter: {
        label: "Démarrage RAG",
        description: "Document → Base vectorielle → Config RAG, déjà reliés.",
      },
      dlStarter: {
        label: "Démarrage DL",
        description: "Jeu d'images → Architecture CNN (Tiny ResNet) → Entraînement DL, déjà reliés.",
      },
      inserted: "Modèle inséré — disposition automatique appliquée.",
    },
    progress: {
      training: "Entraînement… {{pct}}%",
    },
    status: {
      trainFailed: "Échec de l'entraînement : {{error}}",
      trainSuccess: "Entraînement terminé ! Cliquez sur Évaluer pour voir les métriques.",
      saved: "Pipeline enregistré",
      saveFailed: "Échec de l'enregistrement",
      missingNodes: "Ajoutez d'abord un nœud Jeu de données et un nœud Entraînement",
      missingDLNodes: "Ajoutez un nœud Jeu d'images, Architecture CNN et Entraînement DL d'abord",
      dlMissingDataset: "Sélectionnez un jeu d'images sur le nœud Jeu d'images avant de lancer",
      runFailed: "Impossible de démarrer l'entraînement",
    },
  },
  chat: {
    title: "Discussion RAG",
    subtitle: "LLM local + vos documents · diffusé jeton par jeton",
    placeholder: "Posez une question sur vos documents…",
    send: "Envoyer",
    sendAria: "Envoyer le message",
    emptyAlert: "Posez une question sur les documents que vous avez importés. Le modèle ne répondra qu'à partir de votre corpus indexé.",
    sources_one: "{{count}} source utilisée",
    sources_other: "{{count}} sources utilisées",
    thinking: "Réflexion locale…",
    error: "Échec de la discussion. Veuillez réessayer.",
    documentFallback: "document",
    chunkScore: "fragment n°{{index}} · score {{score}}",
    threads: {
      title: "Conversations",
      newButton: "Nouvelle discussion",
      empty: "Aucune conversation pour le moment — démarrez-en une pour la voir ici.",
      draftLabel: "Sans titre (nouvelle)",
      turnCount_one: "{{count}} échange",
      turnCount_other: "{{count}} échanges",
      deleteAria: "Supprimer cette conversation",
      collapseAria: "Masquer la barre des conversations",
      expandAria: "Afficher la barre des conversations",
    },
  },
};
