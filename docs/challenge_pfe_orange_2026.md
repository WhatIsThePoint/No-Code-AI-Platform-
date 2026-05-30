# Challenge PFE — Édition 2026 (Orange Future Talents)

Soumission écrite — 6 slides maximum. Deadline : 29 mai 2026.

Contenu prêt à coller dans le modèle PowerPoint fourni par Orange.
Les champs `[à compléter]` correspondent à des informations
personnelles ou administratives à confirmer.

---

## SLIDE 1 — Informations Générales

| Champ | Valeur |
|---|---|
| Nom et prénom | HAMMI Youssef _(à confirmer)_ |
| Direction | [à compléter — direction Orange d'accueil] |
| Département | [à compléter — département Orange d'accueil] |
| Diplôme et Spécialité | Licence Nationale en Technologies de l'Information — Développement de Systèmes d'Information (DSI) |
| Nom de l'encadrant professionnel | [à compléter] |
| Université | [à compléter — établissement universitaire] |
| Période du stage | [date début] – [date fin] |

---

## SLIDE 2 — Aperçu du Projet

**Titre :**
Plateforme No-Code IA Privacy-First — ML Tabulaire, IA Générative Locale et Deep Learning

**Résumé :**

- **Problème.** Les plateformes no-code de Machine Learning (DataRobot,
  Vertex AI, Azure ML Studio) imposent l'envoi des données vers le
  cloud du fournisseur. Pour les secteurs régulés (santé, banque,
  administration), cette exfiltration est juridiquement interdite
  (GDPR, HIPAA, normes bancaires locales). Les outils existants
  laissent ces utilisateurs sans solution accessible.

- **Approche.** Une plateforme web auto-hébergée qui s'installe sur
  une machine grand public unique (16 GB RAM, GPU 6 GB VRAM). Trois
  charges de travail partagent un même canvas visuel : ML tabulaire
  (14 algorithmes), IA Générative via un pipeline RAG entièrement
  local (Ollama + pgvector), et Deep Learning sur un catalogue
  d'architectures CNN dimensionnées pour la contrainte VRAM. Aucune
  donnée ne quitte jamais la machine de l'utilisateur.

- **Objectifs.** (1) Souveraineté totale des données — aucun appel
  sortant vers un fournisseur IA. (2) Accessibilité pour
  utilisateurs non-techniques via un éditeur drag-and-drop.
  (3) Fonctionnement réel sur matériel grand public, démontré sur
  une carte GTX 1660 Super.

---

## SLIDE 3 — Roadmap du Projet

Six sprints de deux à trois semaines, chacun clôturé par une démo
exécutable et un git tag versionné.

| # | Sprint | Livrable principal |
|---|---|---|
| 1 | Authentification & Ingestion | JWT, gateway zero-trust, upload CSV + connecteurs SQL chiffrés Fernet |
| 2 | ML Tabulaire | Canvas React Flow, 14 algorithmes, SHAP, export joblib + FastAPI |
| 3 | IA Générative locale | RAG bout-en-bout : sentence-transformers + pgvector + Ollama (Llama 3.2 3B) |
| 4 | Deep Learning | Service PyTorch, 3 CNN, garde-fou VRAM, inférence inline |
| 5 | Collaboration | ACL par pipeline (5 rôles), présence temps réel, chat, Google Meet |
| 6 | Opérabilité | Dashboard, billing Stripe, i18n EN/FR, console admin, impersonation |

**Ajustements vs plan initial :** deux sprints décalés d'environ une
semaine. Sprint 2 — bug Plotly d'auto-échelle sur les axes Y mixtes
(progression vs métriques). Sprint 4 — recalibration empirique du
garde-fou VRAM après écart de ~15 % entre estimation théorique et
mesure réelle sur MobileNet-V3 à 224 px.

---

## SLIDE 4 — Actions Menées

**Architecture déployée :**
- 5 microservices Python Flask (gateway, auth, ingestion, ml-training,
  dl-training) + service de métriques TimescaleDB.
- Frontend React 18 + TypeScript + MUI + React Flow + i18next.
- 14 conteneurs Docker orchestrés par un seul `docker-compose.yml`,
  démarrage par commande unique `make up`.
- CI GitHub Actions : 4 jobs parallèles (lint + tests backend et
  frontend), ~14 min pour un changement full-stack.

**Décisions techniques structurantes :**
- **Gateway-only header injection.** Le gateway dépouille tout
  en-tête `X-User-*` côté client puis le réinjecte depuis le JWT
  décodé. Les services en aval font confiance à `X-User-Id` sans
  vérification — frontière zero-trust unique.
- **Volume Docker partagé** pour les artéfacts binaires (datasets,
  modèles, zips d'images). Supprime tout protocole de streaming
  réseau, généralisable aux trois pipelines.
- **Celery par service**, files dédiées. Un entraînement DL de 20
  epochs ne peut bloquer une requête d'authentification.
- **Garde-fou VRAM à 4 niveaux** (slider UI, contrôle de route,
  estimateur statique, plafond dur). Une mauvaise frappe pendant la
  démo ne peut pas OOM le GPU en direct.
- **Quantization LLM** Q4\_K\_M pour faire tenir Llama 3.2 3B en
  ~2 GB VRAM, laissant 4 GB libres pour les autres charges GPU.

---

## SLIDE 5 — Défis et Solutions

**Défi 1 — Souveraineté vs capacités IA modernes**
*Problème :* offrir un chat IA générative compétitif sans dépendre
d'API cloud. *Solution :* pile entièrement locale —
Llama 3.2 3B quantisé Q4\_K\_M (2 GB VRAM) servi par Ollama,
embeddings MiniLM (22 MB, CPU), vector store pgvector co-localisé
dans Postgres. Aucune connexion sortante vers un fournisseur IA.

**Défi 2 — Contrainte matérielle 6 GB VRAM**
*Problème :* PyTorch peut saturer le GPU lors d'une démo en direct.
*Solution :* estimateur statique de mémoire avant chaque
entraînement, formule
`poids + 3×poids (états Adam) + activations + 1 GB headroom`.
Refus structuré côté route si dépassement, avec payload
diagnostique. Défense en profondeur sur 4 couches.

**Défi 3 — Périmètre tentaculaire pour un développeur**
*Problème :* trois charges de travail IA (ML, RAG, DL) plus
collaboration, billing, accessibilité, admin — risque d'effondrement
sous le scope. *Solution :* Scrum-lite avec démo exécutable + git
tag obligatoires en fin de sprint, retrospective écrite, backlog
Markdown versionné. Découpage en six sprints fermés, jamais
plus de deux préoccupations majeures en parallèle.

**Défi 4 — Calibration empirique vs prédictions théoriques**
*Problème :* les constantes du garde-fou VRAM dérivées de la
documentation Turing sous-estimaient la consommation réelle d'environ
15 % sur MobileNet à 224 px. *Solution :* constantes ajustées
empiriquement après mesure GPU, tests unitaires vérifiant la forme
de l'enveloppe (et non les valeurs absolues), permettant la
recalibration future sans casser la suite.

---

## SLIDE 6 — Résultats

**Livrables :**
- 5 microservices Python (~6 500 LOC) + frontend React/TypeScript
  (~13 000 LOC).
- 14 algorithmes ML tabulaires, 3 architectures CNN, pipeline RAG
  complet.
- 14 conteneurs Docker, déploiement single-command, CI verte sur
  `main`.
- 9 révisions Alembic, idempotentes et rejouables.

**Validations mesurées (sur GTX 1660 Super) :**

| Charge | Configuration | Résultat | Durée |
|---|---|---|---|
| ML tabulaire | Random Forest, dataset salary 250 K lignes | **R² = 0,9785** | 4 min 12 s |
| Deep Learning | tiny\_resnet, 3 classes synthétiques, 5 epochs | **Acc. val. 100 %** | ~30 s |
| RAG | Llama 3.2 3B Q4\_K\_M en streaming | **~30 tokens/s**, 0 appel sortant | latence interactive |

**Impact démontré :** une station de travail grand public (16 GB RAM,
6 GB VRAM) suffit pour héberger simultanément un AutoML, un workspace
d'IA générative et une boucle d'entraînement Deep Learning — sans
que les données ne quittent jamais la machine. Pour les secteurs
régulés visés, ce n'est pas un gain marginal : c'est la différence
entre disposer du ML et ne pas en disposer du tout.

**Retours encadrant :** [à compléter]

---

## Notes pour la mise en page Orange

- Le modèle Orange impose la cohérence visuelle (logo, footer,
  charte couleur). Coller le contenu ci-dessus dans les zones de
  texte correspondantes, sans ajouter de slides supplémentaires.
- Pour le pitch oral (étape 2), prévoir une démo écran de
  ~3 minutes : upload CSV → canvas → train → SHAP →
  basculement vers le mode RAG → question/réponse en streaming →
  basculement vers DL → inférence inline. Ce parcours est documenté
  dans `docs/DEMO_DAY_E2E.md`.
- Captures d'écran utiles à ajouter si la place le permet : canvas
  en mode ML, panneau RAG en streaming, panneau de prédiction DL,
  tableau de bord admin.
