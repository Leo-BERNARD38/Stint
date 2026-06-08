# CLAUDE.md — Guide pour les sessions Claude Code

> Contexte pour les IA qui travaillent sur **Stint**. Lis-le avant de coder.
> La langue du projet est le **français** : UI, commentaires et messages de commit.

## 1. C'est quoi Stint

Chronomètre personnel de tâches (dev + support), conçu pour reporter le temps
dans Jira. Application web **mono-page**, **100 % front**, **sans build**, en
**modules ES natifs**. Déployée sur **GitHub Pages** (branche `master`), c'est
une **PWA** installable et hors-ligne.

Contraintes fortes (ne pas casser) :
- **Aucune étape de build / aucune dépendance npm.** Le navigateur charge
  directement `index.html` → `src/main.js` (type=module) et l'arbre d'imports.
- **Statique** : pas de serveur, pas de backend. Tout vit côté navigateur.
- **Tout en relatif** (`./…`) pour fonctionner sous le sous-chemin GitHub Pages.

## 2. Lancer & déployer

- Local : servir en HTTP (les modules ES bloquent `file://`) :
  `python3 -m http.server 8000` puis http://localhost:8000
- Déploiement : `git push` sur `master` (GitHub Pages, dossier racine). `.nojekyll` présent.
- Le service worker ne s'active qu'en HTTP(S).
- **Après toute modif de fichier servi : bumper `CACHE` dans `sw.js`**
  (`stint-vN` → `stint-vN+1`), sinon le cache SW ressert l'ancienne version
  même après Ctrl+F5. (Valeur actuelle : voir `sw.js`.)

## 3. Architecture

Séparation **domaine → services → UI**, flux **unidirectionnel** :

```
commande UI ─▶ Store (mutation + persist + emit "change") ─▶ App.render() ─▶ vues.render()
```

```
index.html              squelette + points de montage ; charge src/main.js (module)
manifest.webmanifest, sw.js, .nojekyll, assets/icon*.png|svg
assets/styles/          variables · base · layout · components   (CSS, voir §7)
src/
  main.js               point d'entrée : instancie App, app.start(), enregistre le SW
  core/
    constants.js        STORAGE_KEY, SCHEMA_VERSION, DAY_MS, PALETTE, DEFAULT_SETTINGS, THEMES…
    EventEmitter.js     on/off/emit (base du Store)
  utils/                datetime · intervals · dom (el/qs/escapeHtml/createEl) · clipboard
  models/               DOMAINE
    Settings.js         réglages + résolution horaires 3 niveaux (voir §5)
    Task.js  Segment.js modèles (fromJSON/toJSON)
    Store.js            SOURCE DE VÉRITÉ : état + commandes + persistance + events
  services/
    Persistence.js      stockage 2 zones : IndexedDB (complet) + miroir localStorage 30 j (§6)
    TimeCalculator.js   temps ouvré (intersection créneaux), agrégats, timeline, trous
    Formatter.js        décimal / Jira / clock(H:mm) / hms ; unités Jira auto (§5)
    DataTransfer.js     export/import JSON, export CSV
    StorageInfo.js      estimation d'occupation (navigator.storage.estimate)
  ui/
    App.js              CONTRÔLEUR : assemble tout, détient l'état d'UI (viewDay, screen), routage
    Timer.js            tick 1 s (EventEmitter)
    DayGlyphAnimator.js anime le glyphe « moment de la journée » image par image
    icons.js            pack d'icônes Lucide inline + glyphes dot-matrix (§8)
    components/         Toast · CopyButton · ScheduleEditor (factory)
    views/              une vue = bind() (1×) + render(viewDay) ; voir liste ci-dessous
    modals/             Modal (base) · NewTask · Resume · EditTask
```

Vues (toutes ajoutées à `App.views`, rendues à chaque changement d'état) :
`HeaderView, ThemeView, HeroView, TabsView, DayNavView, TimelineView, TotalsView,
TaskListView, SegmentTableView, AllTasksView, SettingsView, StorageView`.

### Conventions de vue (à respecter pour toute nouvelle vue)
- Constructeur `(app)` ; récupère ses éléments via `el("id")`.
- `bind()` : câble les écouteurs **une seule fois** (appelé une fois au démarrage).
- `render(viewDay)` : (re)dessine à partir de l'état ; **ne crée pas d'écouteurs**.
- Pas d'état dupliqué : on relit toujours `app.store` au rendu.
- Les vues **ne mutent jamais** l'état : elles appellent des commandes du `Store`
  ou des méthodes de `App`.
- Délégation d'évènements sur un conteneur stable quand le contenu est reconstruit.

### App (contrôleur)
- Détient l'UI-state : `viewDay` (jour affiché) et `screen` (`app|settings|guide`).
- Écrans : `#appScreen` (onglets Journée/Segments/Tâches) vs `#settingsScreen` /
  `#guideScreen` (pages pleines, ouvertes via le header). `showScreen()`.
- Onglets gérés par `TabsView` ; le sélecteur de jour (`#dayHead`) est masqué sur
  l'onglet « Tâches » (vue tout-temps).
- `App.start()` est **async** : rendu instantané (miroir local) → `await store.ready()`
  (IndexedDB + migration) → câblage des interactions → re-render. Voir §6.

## 4. Modèle de données (schéma v4)

```jsonc
{
  "version": 4,
  "settings": {
    "appName": "Stint", "theme": "system",          // system|light|dark
    "workDays": [1,2,3,4,5],                          // 1=lun … 7=dim
    "arrival": "08:30", "lunchStart": "12:30",
    "lunchEnd": "13:30", "departure": "17:00",
    "weekdayHours": { "5": [["08:30","12:50"]] },     // exceptions par jour de semaine
    "dateHours": { "2026-06-12": [["08:30","12:30"],["13:30","16:30"]] }, // par date ; [] = non travaillé
    "jira": { "auto": true, "hoursPerDay": 8, "daysPerWeek": 5 },
    "rounding": "none"                                 // none|1m|5m|15m
  },
  "tasks": [{ "id":"t_…", "name":"…", "type":"dev|support|autre",
              "color":"#…", "done":false, "archived":false }],
  "segments": [{ "id":"s_…", "taskId":"t_…",
                 "start":"ISO local", "end":"ISO local|null", "raw":false }],
  "meta": { "lastExport": null }
}
```

Notes :
- **`name` porte la clé Jira** (ex. « MOD-123 ») — il n'y a **plus de champ jiraKey**.
- Durées **jamais stockées** : toujours dérivées des timestamps (robuste à la veille).
- `done` = terminée (hors « Reprise »), `archived` = masquée des listes.

### Changer le modèle de données — checklist obligatoire
1. Modifier le(s) modèle(s) (`fromJSON`/`toJSON`).
2. **Bumper `SCHEMA_VERSION`** dans `core/constants.js`.
3. Ajouter la transformation dans **`Store.#migrate(raw)`** (idempotente ; ex. le
   repli de `jiraKey` dans `name` en v3→v4).
4. `Store.hydrate` réécrit toujours `version` au format courant ; `Store.load()`
   persiste au chargement → le stockage existant est **normalisé automatiquement**.
5. Mettre à jour les valeurs par défaut (`DEFAULT_SETTINGS`) si besoin.

## 5. Horaires & calculs

- **3 niveaux**, du plus général au plus spécifique : base (4 heures + `workDays`)
  → `weekdayHours[isoDow]` → `dateHours["YYYY-MM-DD"]`. Résolution dans
  **`Settings.blocksFor(date)`** ; précédence **date > jour de semaine > base**.
  Un planning = liste de créneaux `[["HH:MM","HH:MM"], …]` ; `[]` = non travaillé.
- **Temps ouvré** : `TimeCalculator.workRangesForDay` → intersection des segments
  avec les créneaux (gère le multi-jours). `seg.raw = true` ⇒ temps réel sans rognage.
- **Unités Jira** : `Formatter.effHoursPerDay/effDaysPerWeek`. En mode `jira.auto`,
  `1d` = durée ouvrée de la base, `1w` = nombre de `workDays` ; sinon valeurs saisies.
- **Affichage des durées en `H:mm`** (`Formatter.clock`). La **copie** reste en
  **décimal** (`1.5`) et **Jira** (`1h 30m`) — ne pas confondre.

## 6. Persistance (2 zones)

- **IndexedDB** = primaire (historique complet). **localStorage** = miroir des
  **30 derniers jours** (synchrone → démarrage instantané, + redondance).
- On **ne tronque le miroir que si IndexedDB est OK** ; sinon localStorage garde
  tout (aucune perte). Si IndexedDB indisponible → repli localStorage complet.
- Démarrage : `Store` (constructeur) hydrate depuis `loadSync()` (instantané) ;
  `await store.ready()` ouvre IndexedDB, charge l'historique complet (**IDB fait
  foi**) et migre l'ancien localStorage si IDB est vide.
- API `Persistence` : `loadSync()`, `init()`, `loadFull()`, `save(full)`, `clear()`.

## 7. Style / thème (CSS)

- 4 feuilles : `variables.css` (jetons + thèmes), `base.css` (reset),
  `layout.css` (structure), `components.css` (composants).
- **Toute la sémantique de couleur est en variables**, thémée par `[data-theme]`
  (`light|dark|system`). **Aucune couleur en dur** hors `variables.css`. Avant de
  committer du CSS, vérifier que tout `var(--x)` est défini (cf. §9).
- **Design flat** : pas de bordures structurelles ; on distingue par **surfaces**
  (`--surface`, `--surface-2`) et **espace**. Échelle d'espacement `--sp-1..8`.
- **Esthétique « Nothing OS »** : **filets pointillés** (`--dot`), **grille de
  points** sur la timeline (`--dot-grid`), **pilules** partout (rayon
  `--radius-pill` ; petits boutons, badges, sélecteur de jour, « Aujourd'hui »),
  point « live » rouge. **Rayons volontairement proches** (`--radius` 18 /
  `--radius-sm` 14 / `--radius-xs` 11) : cartes au grand rayon, petits éléments en
  pilule. Sélecteur de jour **en couleurs inversées** (comme « Total du jour »).
- **Onglets = contrôle segmenté** avec **curseur glissant** : une pilule `::before`
  sur `.tabs` translatée via `:has([data-tab=…].active)` (3 colonnes égales).
- **Motion** : flat mais fluide — survol des gros boutons (translation + zoom du
  glyphe), **éclosion `dotIn`** des glyphes dot-matrix, pulsation du repère
  « maintenant », **dépliage animé** de l'onglet Tâches (`.at-segs-wrap` en
  `grid-template-rows 0fr→1fr`). Dans « Total journée », **glyphe `dayGlyph`**
  (lever de soleil / soleil / coucher / lune selon l'heure, grille 9×9, points
  jointifs) animé **image par image** par `DayGlyphAnimator` (vraie animation de
  points en JS, ~4-5 fps, pas de CSS). Timeline = carte au grand rayon,
  points en fond, blocs arrondis **affleurant le container** (sans marge). Tout
  est neutralisé sous `prefers-reduced-motion`.
- **2 polices seulement** : `--font-display` = **Bitcount Grid Single** (dot-matrix :
  wordmark, titres de page/bloc, gros afficheurs comme le chrono et les totaux) ;
  `--font-body` = **Inter** (corps **et tous les petits labels ≤ 12 px** — capitales
  comprises — pour la lisibilité). **Pas de serif.** Durées en `tabular-nums`.
- **Icônes des 4 gros boutons** : glyphes **monochromes en grille de points 5×5**
  (carrée, points jointifs, traits 1 point pour « + » et « pause » ; même rendu
  que la police), via `dotIcon()` dans `ui/icons.js`. « Reprise » = barre +
  triangle (clé `resume`).
  Le reste de l'UI garde les silhouettes Lucide (`icon()`).
- **Couleurs des tâches** : 3 palettes **par catégorie** (`PALETTES` dans
  `constants.js`) — dev = froides, support = chaudes, autre = neutres. Attribution
  cyclique au sein de la catégorie (`Store.#nextColor(type)`).
- Thème appliqué sans flash par un petit script inline dans `<head>` (lit le thème
  stocké avant le 1ᵉʳ rendu). `ThemeView` met aussi à jour `<meta name="theme-color">`.

## 8. Icônes

- `src/ui/icons.js` : pack **Lucide** vendu en SVG inline (aucun réseau, thémé via
  `currentColor`). `icon(name, {size, solid})` renvoie le balisage.
- Icônes statiques du HTML : `<span data-icon="name">` rempli par
  `renderStaticIcons()` au démarrage. **Ajouter une icône** = ajouter une entrée
  dans la map `ICONS`.
- Clic sur un bouton contenant une icône : déléguer via `e.target.closest('[data-…]')`
  (le clic peut viser le `<svg>` enfant).

## 9. Vérifications avant commit (pas de framework de test)

Lancer ces contrôles (rapides, en Node) :
- **Syntaxe** : `for f in $(find src -name '*.js'); do node --check "$f"; done`
- **IDs** : tout `el("x")` du JS doit avoir un `id="x"` dans `index.html`.
- **Icônes** : tout `data-icon="x"` doit exister dans la map `ICONS`.
- **CSS** : accolades équilibrées par fichier ; tout `var(--x)` utilisé est défini
  dans `variables.css`.
- **Logique métier** : tests ad hoc en Node ESM avec une persistance **simulée**
  (objet `{loadSync, init, loadFull, save, clear}`) — ex. migration, résolution
  d'horaires, formats. `node --input-type=module -e '…import depuis file://…'`.
  (IndexedDB/DOM ne tournent pas en Node : on teste le domaine, pas le rendu.)
- **Je ne peux pas voir le rendu** dans cet environnement : signaler les
  changements visuels à valider par l'utilisateur (capture clair + sombre).

## 10. Pièges déjà rencontrés (à connaître)

- **`hidden` annulé par `display`** : un élément avec l'attribut `hidden` mais une
  règle `display:flex/grid` reste visible. Garde-fou global présent
  (`[hidden]{display:none!important}` dans `base.css`) — ne pas le retirer.
- **Vol de focus dans la table Segments** : `SegmentTableView.render()` **ne
  reconstruit pas** le tableau si le focus est à l'intérieur (édition en cours) ;
  la durée de ligne est mise à jour à la main. Ne pas réintroduire un rebuild
  systématique.
- **Icônes ré-animées en boucle** : `HeroView`/`ThemeView` ne réinjectent le SVG
  que lorsque l'état change (sinon l'animation `popIn` jouerait à chaque rendu).
- **scrollbar-gutter** : `html { scrollbar-gutter: stable }` évite les sauts de
  layout entre onglets — garder.
- **Course de données au démarrage** : on câble les interactions **après**
  `store.ready()` pour qu'un clic précoce ne soit pas écrasé par le chargement IDB.

## 11. Git

- Développer et pousser sur **`master`** (branche de déploiement).
- **Messages de commit en français**, descriptifs (sujet + corps expliquant le
  pourquoi). Garder le style des commits existants.
- Ne pas créer de PR sauf demande explicite.
