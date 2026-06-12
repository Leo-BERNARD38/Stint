# Architecture

Front pur, **modules ES natifs**, aucun build. L'organisation suit une séparation
nette **domaine → services → UI**, pour rester lisible et faciliter les évolutions
(y compris une migration ultérieure vers Vite + React).

## Arborescence

```
index.html                 Squelette + points de montage, charge src/main.js (type=module)
manifest.webmanifest       PWA : installable (icônes, nom, couleurs)
sw.js                      Service worker : précache versionné, hors-ligne, mises à jour cohérentes
.nojekyll                  Désactive Jekyll sur GitHub Pages
assets/styles/
  variables.css            Jetons de design — chaque couleur via light-dark(clair, sombre)
  base.css                 Reset + typographie
  layout.css               Mise en page (header, sections, grilles)
  components.css           Composants (boutons, cartes, timelines, modales, toast)
src/
  main.js                  Point d'entrée : instancie et démarre App, enregistre le SW
  core/
    constants.js           Constantes + valeurs par défaut (aucune dépendance)
    EventEmitter.js        Bus d'évènements minimal (on/off/emit)
  utils/
    datetime.js            Dates/heures, ISO local, jour ISO, toMin, cap
    intervals.js           overlap / union / soustraction / découpe ouvrée d'intervalles
    dom.js                 Sélecteurs, escapeHtml, createEl
    clipboard.js           Copie presse-papier (avec repli)
  models/                  DOMAINE
    Settings.js            Réglages (horaires 3 niveaux, Jira, arrondi)
    Task.js                Tâche (nom, type, couleur, état terminé/archivé)
    Segment.js             Segment horodaté (start/end ISO, raw, timestamps mémoïsés)
    Store.js               Source de vérité : état + commandes + persistance + events
  services/                LOGIQUE TRANSVERSE
    Persistence.js         Stockage double zone : IndexedDB (complet) + miroir localStorage (30 j)
    TimeCalculator.js      Temps ouvré, agrégats, fenêtre timeline, trous
    Formatter.js           Décimal, Jira, arrondi, horloge
    DataTransfer.js        Export/import JSON, export CSV, téléchargement
    StorageInfo.js         Estimation d'occupation (navigator.storage.estimate)
  ui/                      PRÉSENTATION
    App.js                 Contrôleur racine : assemble tout, orchestre les flux
    Timer.js               Tick 1 s (EventEmitter)
    DayGlyphAnimator.js    Anime la scène « moment de la journée » image par image
    icons.js               Pack Lucide inline + glyphes dot-matrix + scène dayGlyph
    components/
      Toast.js             Notification éphémère
      CopyButton.js        Fabrique de bouton « copier »
      ScheduleEditor.js    Éditeur de planning d'une journée (créneaux)
      TimelineTip.js       Infobulle partagée des timelines (.tl-tip)
    views/                 Une vue = une région du DOM (bind optionnel + render + anchor)
      HeaderView, ThemeView, HeroView, TabsView, DayNavView, TimelineView,
      TotalsView, TaskListView, SegmentTableView, StatsView, StatsTimelineView,
      AllTasksView, SettingsView, StorageView, ToolsView
    modals/
      Modal.js             Base (ouverture/fermeture)
      NewTaskModal, ResumeModal, EditTaskModal
```

## Flux de données (unidirectionnel)

```
        commande (clic / raccourci)
UI  ───────────────────────────────────▶  Store
                                            │  mutation + persist()
                                            │  emit("change")
        render(viewDay)                     ▼
UI  ◀───────────────────────────────────  App (écoute "change")
```

- **`Store`** est l'unique source de vérité. Ses commandes publiques (`toggle`,
  `startNew`, `resume`, `updateSegment`, …) mutent l'état, persistent une fois, puis
  émettent `change`. Les primitives privées (`#startSegment`, `#stopActive`, …) ne
  committent pas : elles sont composées par les commandes pour éviter les doubles écritures.
- **`App`** écoute `change` et appelle `render(viewDay)` sur chaque vue **visible**
  (une vue déclare son élément `anchor` ; celles sous un ancêtre `[hidden]` — autre
  onglet, autre écran — sont rendues à la bascule). Il détient l'état purement UI :
  le **jour affiché** (`viewDay`) et l'**écran courant** (`screen`).
- **Les vues** ne mutent jamais l'état directement : elles appellent des méthodes du
  contrôleur (`app.*`) ou des commandes du `Store`. Elles relisent toujours l'état au
  rendu — pas d'état dupliqué.

## Principes

- **Durées dérivées des timestamps** : aucune durée n'est stockée. À la reprise (veille,
  onglet rouvert), `App` re-rend sur `focus`/`visibilitychange` et tout se recalcule.
- **Calculs purs et testables** : `TimeCalculator` et `Formatter` ne touchent pas au DOM
  et lisent `store.settings` en direct ; ils sont couverts par des tests d'intégration
  Node (mêmes modules que le navigateur, persistance simulée).
- **Persistance isolée** derrière `Persistence` (IndexedDB + miroir localStorage) :
  passer à un backend ne toucherait que ce fichier.
- **Modèle versionné** (`version` dans le JSON) : base saine pour de futures migrations.
