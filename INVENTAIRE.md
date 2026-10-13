# Inventaire du code

> **Généré** par `node checks/inventaire.mjs` — ne pas éditer à la main.
> `node checks/inventaire.mjs --check` échoue s'il est périmé (§9 de CLAUDE.md).
> Le rôle d'un fichier est la première phrase de la doc de son premier export.

64 modules JS.

## Composants partagés — à réutiliser avant d'en écrire un

Factories et fonctions appelées par plusieurs vues. Un besoin qui ressemble à l'une de ces lignes passe par elle.

| Fichier | Rôle | Exporte |
|---|---|---|
| `ui/components/CopyButton.js` | Bouton « copier » avec icône + libellé et retour visuel | `createCopyButton()` |
| `ui/components/FillPopover.js` | Popover de remplissage d'un trou (temps non tracé) | `createFillPopover()` |
| `ui/components/MemoList.js` | Liste de mémos (factory, comme `FillPopover`) : une case « fait », le texte, la tâche rattachée (puce + nom, clic = éditer la tâche) et une croix | `createMemoList()`, `memoBadge()` |
| `ui/components/ScheduleEditor.js` | Éditeur de planning d'une journée, dans la seule grammaire de l'application : **arrivée, départ, et une pause déjeuner ou non** | `createScheduleEditor()`, `describeBlocks()` |
| `ui/components/TaskField.js` | Champ « Tâche » d'un formulaire (modale de segment, panneau des mémos) : un déclencheur qui dit la tâche choisie et déplie EN PLACE le sélecteur … | `createTaskField()` |
| `ui/components/TaskPicker.js` | LE sélecteur de tâche — la même liste partout où l'on choisit une tâche : combler un trou de la timeline, compléter un jour de la Saisie, reprendre … | `taskPickerHtml()`, `pickedTask()`, `bindTaskPicker()`, `pickerTask`, `pickerTasks()` |
| `ui/components/TimelineTip.js` | Infobulle maison des timelines (`.tl-tip`) : suit le curseur au-dessus des blocs `.tl-seg` et affiche nom / plage / durée lus dans leurs `data-*`. … | `attachTimelineTip()` |
| `ui/components/Toast.js` | Notification éphémère en bas d'écran : `show(message, { kind })`, `kind` = `ok` (coche, défaut), `info` (sans pictogramme) ou `error` (croix, plus … | `Toast` |

API détaillée :

- **MemoList.js**
  - `createMemoList()` — Liste de mémos (factory, comme `FillPopover`) : une case « fait », le texte, la tâche rattachée (puce + nom, clic = éditer la tâche) et une croix
  - `memoBadge()` — L'indicateur d'une ligne de tâche : icône + nombre de mémos ouverts, ou rien
- **ScheduleEditor.js**
  - `createScheduleEditor()` — Éditeur de planning d'une journée, dans la seule grammaire de l'application : **arrivée, départ, et une pause déjeuner ou non**
  - `describeBlocks()` — Résumé lisible d'un planning, pour les listes
- **TaskPicker.js**
  - `taskPickerHtml()` — Le balisage du sélecteur (recherche + groupes + terminées repliées)
  - `pickedTask()` — L'identifiant de la tâche sélectionnée dans `root` (`""` = sans tâche), ou `null`
  - `bindTaskPicker()` — Câble le sélecteur dans `root` (conteneur stable). `onSelect(id, { click })` est appelé à chaque changement de sélection ; `click` dit si elle vient …
  - `pickerTask` — Une tâche du Store au format du sélecteur
  - `pickerTasks()` — Les tâches du Store dans l'ORDRE COMMUN à tous les sélecteurs : les plus récemment pointées d'abord (celle qu'on cherche est presque toujours l'une …

## Vues

Une vue = une région du DOM : `bind()` (une fois) + `render(viewDay)` + `anchor` (§3).

| Fichier | Rôle | Exporte |
|---|---|---|
| `ui/views/AllTasksView.js` | Onglet Tâches : recherche/filtres + liste des tâches **regroupées** par jour, semaine ou mois (selon la date d'ouverture) | `AllTasksView` |
| `ui/views/DayNavView.js` | Navigation par jour (v1 centrée sur aujourd'hui + précédent/suivant) | `DayNavView` |
| `ui/views/DayTotalView.js` | Carte « Total aujourd'hui » du héros — **toujours visible** (au-dessus des onglets, sur tous les onglets de l'app) | `DayTotalView` |
| `ui/views/HeaderView.js` | En-tête : wordmark éditable (= nom de l'app) + pastille de statut | `HeaderView` |
| `ui/views/HeroView.js` | Barre de contrôle : carte de tâche active + 4 boutons (Play/Pause, Nouvelle, Reprise, Terminer) | `HeroView` |
| `ui/views/MemoPanelView.js` | Panneau latéral des mémos : « pour demain », général ou rattaché à une tâche | `MemoPanelView` |
| `ui/views/SegmentTableView.js` | Tableau des segments du jour, **en lecture seule** : toute modification passe par la modale (clic sur une ligne) ou par la timeline au-dessus … | `SegmentTableView` |
| `ui/views/SettingsView.js` | Réglages : horaires (base + exceptions jour/date), conversion Jira, arrondi, rappel « repos des yeux » et apparence | `SettingsView` |
| `ui/views/StatsChartView.js` | Bloc « Évolution » : le même sujet vu de loin ou de près, **jamais les deux à la fois**. - **Volume** — les 12 dernières périodes de même grain, … | `StatsChartView` |
| `ui/views/StatsDetailView.js` | Bloc « Détail » : l'outil pratique de la rétrospective, en **quatre onglets dont un seul est rendu** | `StatsDetailView` |
| `ui/views/StatsView.js` | Tête de l'onglet Stats : la **navigation calendaire** (qui pilote tout l'onglet), le bandeau de tête et la couverture de la période | `StatsView` |
| `ui/views/StorageView.js` | Jauge d'espace de stockage (réglages) + actions de maintenance | `StorageView` |
| `ui/views/TabsView.js` | Onglets de l'écran application (Journée / Segments) | `TabsView` |
| `ui/views/TaskListView.js` | Liste des tâches du jour : durée, copie, et actions selon le cycle de vie | `TaskListView` |
| `ui/views/ThemeView.js` | Gère le thème (clair / sombre / système) : applique data-theme, synchronise le bouton cyclique du header **et** le contrôle segmenté des réglages, … | `ThemeView` |
| `ui/views/TimelineView.js` | Timeline journalière : segments colorés **redimensionnables** (poignées sur chaque bord, snap 5 min), **trous cliquables** (popover de remplissage : … | `TimelineView` |
| `ui/views/TimesheetView.js` | Onglet **Saisie** (§17) : ce qu'on DÉCLARE dans Jira, semaine par semaine | `TimesheetView` |
| `ui/views/ToolsView.js` | Écran « Outils » : deux utilitaires sans état persistant qui réutilisent le domaine — un convertisseur de durée (tous formats + copie) et un calcul … | `ToolsView` |
| `ui/views/TotalsView.js` | Aside « Totaux » de l'onglet Journée : ventilation par type, total du jour + copie Déc./Jira, bloc « Temps non tracé » (liste des trous avec bouton … | `TotalsView` |

## Modales

Héritent de `Modal` (ouverture, `[data-close]`, clic hors carte).

| Fichier | Rôle | Exporte |
|---|---|---|
| `ui/modals/EditTaskModal.js` | Édition d'une tâche : nom (qui porte la clé Jira), type (chips), couleur (color picker libre), lien externe (une URL Jira, par exemple), archiver, … | `EditTaskModal` |
| `ui/modals/Modal.js` | Base des modales : gestion ouverture/fermeture du backdrop | `Modal` |
| `ui/modals/NewTaskModal.js` | « Nouvelle tâche » : crée et démarre immédiatement | `NewTaskModal` |
| `ui/modals/ResumeModal.js` | « Reprise » : choisir une tâche et la relancer | `ResumeModal` |
| `ui/modals/SegmentModal.js` | Création / édition d'un segment (tâche, début, fin, brut) | `SegmentModal` |

## UI (contrôleur, boucles, icônes)

| Fichier | Rôle | Exporte |
|---|---|---|
| `ui/App.js` | Contrôleur racine : assemble modèle (Store), services (calc, formatter), vues et modales | `App` |
| `ui/BgDots.js` | Fond dot-matrix « spotlight » (easter-egg, désactivé par défaut) | `BgDots` |
| `ui/Chime.js` | Le bip du repos des yeux : deux notes de synthèse, montantes à l'appel, descendantes à la fin (§13) | `Chime` |
| `ui/DayGlyphAnimator.js` | Anime le glyphe « moment de la journée » (Total journée) **image par image** : fait défiler les frames du glyphe à bas FPS en réécrivant ses points | `DayGlyphAnimator` |
| `ui/EyeBreak.js` | Rappel « repos des yeux » (règle 20-20-20) | `EyeBreak` |
| `ui/Reminders.js` | Rappels de la journée : pause déjeuner, fin de journée, et les pauses qu'on pose soi-même (« 10:00 pause café », « 14:00 réunion » le 8 septembre) | `Reminders` |
| `ui/Timer.js` | Horloge applicative : émet `tick` chaque seconde (§7 réactivité 1 s) | `Timer` |
| `ui/icons.js` | Pack d'icônes — silhouettes Lucide (https://lucide.dev, licence ISC/MIT), embarquées localement en SVG inline : aucun appel réseau, fonctionne … | `icon()`, `dotIcon()`, `dayGlyphName()`, `dayGlyphFrames()`, `dayGlyph()`, `renderStaticIcons()` |

## Modèles (domaine)

Purs, testés dans `checks/domaine.mjs`.

| Fichier | Rôle | Exporte |
|---|---|---|
| `models/Memo.js` | Un mémo : une ligne de texte à se laisser pour demain, rattachée à une tâche (`taskId`) ou générale (`null`). `done` la barre sans l'effacer — on … | `Memo` |
| `models/Segment.js` | Un segment horodaté (début → fin) | `Segment` |
| `models/Settings.js` | Réglages de l'application | `clampEyeMinutes()`, `clampEyeRest()`, `clampMergeGap()`, `clampMinSegment()`, `normalizeTimesheetStep()`, `clampVolume()`, `normalizeBreak()`, `mergeBlocks()`, `blocksFromDay()`, `dayFromBlocks()`, `validateDay()`, `normalizeOffLabel()`, `offKey()`, `Settings` |
| `models/Store.js` | Source de vérité unique | `Store` |
| `models/Task.js` | Une tâche : nom (qui porte la clé Jira si c'en est une), type (dev/support/ autre), couleur, lien externe optionnel (ex | `Task` |
| `models/TimesheetLines.js` | Lignes d'un jour de SAISIE (§17) : ce qu'on déclare dans Jira ce jour-là, tâche par tâche — `{ taskId, min, done }`. `done` = « saisi dans Jira » | `normalizeLines()`, `toggleLine()`, `setAllDone()`, `removeLine()`, `setLine()`, `addToLine()` |

## Services

| Fichier | Rôle | Exporte |
|---|---|---|
| `services/DataTransfer.js` | Import / export (§6.9) | `DataTransfer` |
| `services/Formatter.js` | Conversions d'affichage : décimal (§9.2), Jira `w d h m` (§9.3) et horloge h:mm:ss | `Formatter` |
| `services/Notifier.js` | Notifications système — le canal qui sort de l'onglet | `Notifier` |
| `services/Persistence.js` | Stockage à deux zones de l'état complet : IndexedDB (fait foi) + miroir localStorage des 30 derniers jours (§6) | `Persistence` |
| `services/StatsAggregator.js` | Agrégats rétrospectifs de l'onglet Stats : la période choisie, son historique de contexte, son découpage interne, ses tâches et ses indicateurs | `STATS_GRAINS`, `CONTINUITY_MAX_DAYS`, `allUnit()`, `periodStart()`, `stepPeriod()`, `StatsAggregator` |
| `services/StorageInfo.js` | Estimation de l'espace de stockage occupé | `storageSnapshot()`, `refreshStorage()`, `formatBytes()` |
| `services/TimeCalculator.js` | Calcule les durées ouvrées et les agrégats journaliers à partir des segments et des réglages (§9.1) | `TimeCalculator` |
| `services/Timesheet.js` | SAISIE LISSÉE (§17) : passer de ce qu'on a POINTÉ à ce qu'on DÉCLARE dans Jira | `Timesheet` |

## Utilitaires

Fonctions pures sans état, réutilisables partout.

| Fichier | Rôle | Exporte |
|---|---|---|
| `utils/clipboard.js` | Copie presse-papier avec repli `execCommand` pour les contextes restreints | `copyText()` |
| `utils/color.js` | Utilitaires de couleur — le strict nécessaire pour écrire du texte PAR-DESSUS une couleur de tâche choisie librement par l'utilisateur | `luminance()`, `onColorClass()` |
| `utils/curve.js` | Chemins SVG pour les courbes de l'onglet Stats | `linePath()`, `smoothPath()`, `areaPath()` |
| `utils/datetime.js` | Aides date/heure | `pad2`, `cap`, `toMin()`, `startOfDay()`, `addDays()`, `isoDow()`, `sameDay()`, `atTime()`, `fmtClock()`, `fmtDateInput()`, `parseDateInput()`, `fmtDateTimeLocal()`, `parseDateTimeLocal()`, `toLocalISO()`, `formatLongDate()`, `isoWeek()`, `mondayOf()`, `countDays()`, `eachDateKey()`, `formatDateShort()`, `formatDateRange()`, `parseDuration()` |
| `utils/dom.js` | Petites aides DOM partagées par les vues | `el`, `qsa`, `escapeHtml()`, `createEl()` |
| `utils/intervals.js` | Opérations sur des intervalles temporels `[start, end]` (en ms) | `intersect()`, `unionIntervals()`, `subtractIntervals()`, `workedParts()` |
| `utils/search.js` | La recherche de tâche — UNE règle pour toutes les listes qui filtrent des tâches (sélecteur des popovers et de la Reprise, champ de tâche, onglet … | `searchKey()`, `queryTerms()`, `matchesQuery()` |

## Noyau

| Fichier | Rôle | Exporte |
|---|---|---|
| `core/EventEmitter.js` | Émetteur d'évènements minimal (pattern observateur) | `EventEmitter` |
| `core/constants.js` | Constantes globales et valeurs par défaut | `STORAGE_KEY`, `SCHEMA_VERSION`, `DAY_MS`, `SEGMENT_MERGE_GAP_MAX_MIN`, `SEGMENT_MIN_MAX_MIN`, `PALETTES`, `PALETTE`, `WEEKDAY_LABELS`, `TASK_TYPES`, `THEMES`, `DEFAULT_SETTINGS`, `TIMESHEET_STEPS`, `MEMO_TEXT_MAX`, `OFF_REASON_MAX`, `OFF_LABEL_MAX`, `EYE_BREAK_MIN`, `EYE_BREAK_MAX`, `EYE_REST_MIN`, `EYE_REST_MAX`, `REMINDER_LABEL_MAX`, `REMINDER_MAX`, `DATE_RANGE_MAX_DAYS`, `DATE_HOURS_MAX` |

## Entrée

| Fichier | Rôle | Exporte |
|---|---|---|
| `main.js` | Point d'entrée de Stint | — |

## Feuilles de style

Sections de chaque feuille (titres `/* ---------- … ---------- */`). Chercher la classe existante avant d'en créer une.

- `assets/styles/base.css` — sans sections
- `assets/styles/components.css`
  - l. 7 — Header / logo / wordmark
  - l. 39 — Boutons icône (thème, etc.)
  - l. 57 — Panneau des mémos
  - l. 96 — Titres de bloc
  - l. 109 — Onglets (texte au-dessus du curseur glissant)
  - l. 119 — Carte tâche active
  - l. 163 — Repos des yeux (20-20-20)
  - l. 262 — Gros boutons (flat : glyphe à gauche, libellé empilé)
  - l. 296 — Navigation jour (pilule inversée, même largeur que les onglets)
  - l. 317 — Timeline (carte arrondie, grille de points, blocs en pilule)
  - l. 318 — Fond dot-matrix « spotlight » (easter-egg, piloté par BgDots.js)
  - l. 487 — Popover de remplissage d'un trou (flottant)
  - l. 519 — Sélecteur de tâche des popovers (TaskPicker)
  - l. 547 — Champ « Tâche » d'un formulaire (TaskField)
  - l. 582 — Bloc « Temps non tracé » (aside Journée)
  - l. 614 — Couverture du jour (rail Totaux)
  - l. 640 — Carte « Total du jour » (héros, toujours visible)
  - l. 660 — Totaux (aside Journée)
  - l. 684 — Panneau : la carte de contenu
  - l. 704 — Liste des tâches (espace + survol, aucune ligne)
  - l. 788 — Onglet « Tâches » : liste groupée (jour / semaine / mois)
  - l. 831 — Segments (table flat : ni bordures ni zébrage — des colonnes)
  - l. 968 — Pile de précédence des horaires
  - l. 1027 — Réglages : champs & blocs
  - l. 1067 — Jauge de stockage
  - l. 1076 — Exceptions d'horaires (jour de semaine / date)
  - l. 1123 — Modales (surfaces flottantes : ombre autorisée)
  - l. 1162 — Icônes
  - l. 1207 — Toast
  - l. 1215 — Page Guide
  - l. 1293 — Convertisseur
  - l. 1330 — Calcul brut / net
  - l. 1440 — Navigation : le grain à gauche, la période à droite
  - l. 1516 — Évolution · Volume : 12 périodes de contexte
  - l. 1556 — Évolution · Continuité : une ligne par jour
  - l. 1576 — Détail : répartitions, hors tâche, découpage
  - l. 1608 — Détail · Par tâche
  - l. 1635 — Détail · Découpage (jours, semaines ou mois de la période)
  - l. 1688 — Détail · Arrondi (l'écart que fait l'arrondi de Journée)
  - l. 1831 — La feuille : tâches × jours
  - l. 1930 — Popover d'une case / d'un manque
- `assets/styles/fonts.css` — sans sections
- `assets/styles/layout.css`
  - l. 5 — En-tête (flat : pas de bordure, juste un fond translucide)
  - l. 25 — Barre de contrôle (héros toujours visible)
  - l. 50 — Onglets (piste de la pilule segmentée + curseur glissant)
  - l. 82 — Perforation
  - l. 93 — Écrans (application / réglages / guide)
  - l. 111 — Sélecteur de jour (sous les onglets, commun à Journée et Segments)
  - l. 118 — Grille de la journée
  - l. 130 — Formulaires (modales)
- `assets/styles/variables.css` — sans sections
