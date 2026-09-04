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
  (`stint-vN` → `stint-vN+1`). (Valeur actuelle : voir `sw.js`.)
  **C'est le seul chemin vers une nouvelle version** : la navigation elle-même est
  servie depuis le précache (voir plus bas), donc un `CACHE` non bumpé = un
  déploiement invisible, quoi qu'on ait poussé.
- **Tout nouveau fichier servi doit être ajouté à `CORE` dans `sw.js`** : les
  assets sont servis **cache-d'abord** depuis le précache (une version = un
  cache cohérent). Le précache contourne le cache HTTP (`cache:"reload"`) et la
  page se recharge seule quand une nouvelle version prend la main
  (`controllerchange` dans `main.js`).
- **La navigation aussi vient du précache** (racine et `index.html` de la portée
  seulement ; toute autre page du même hôte part au réseau). Le réseau d'abord
  semblait plus sûr : il ne l'était pas. `fetch()` consulte le **cache HTTP**, et
  GitHub Pages sert en `max-age=600` — pendant dix minutes après un déploiement,
  la navigation rendait donc l'**ancien** `index.html` pendant que les assets
  venaient du précache **neuf**. Vieux HTML + CSS/JS neufs, c'est-à-dire
  exactement le panachage que le service worker existe pour empêcher : c'était
  la cause du « il faut faire Ctrl+F5 ». Corollaire : `main.js` enregistre avec
  `updateViaCache: "none"` et revérifie à la reprise de focus, au retour de
  visibilité **et** toutes les 30 min (une app qu'on laisse ouverte tout le jour
  dans sa propre fenêtre ne perd jamais le focus).
- **L'icône d'une PWA déjà installée ne se met pas à jour** en redéployant : le
  lanceur (OS) la fige à l'installation. Changer `assets/icon-*.png` n'y suffit
  pas — il faut désinstaller/réinstaller. À dire à l'utilisateur plutôt que de
  chercher un correctif côté code : il n'y en a pas.

## 3. Architecture

Séparation **domaine → services → UI**, flux **unidirectionnel** :

```
commande UI ─▶ Store (mutation + persist + emit "change") ─▶ App.render() ─▶ vues.render()
```

```
index.html              squelette + points de montage ; charge src/main.js (module)
manifest.webmanifest, sw.js, .nojekyll, assets/icon*.png|svg
assets/styles/          fonts · variables · base · layout · components   (CSS, voir §7)
assets/fonts/           9 woff2 auto-hébergés (Bitcount · Archivo · Plex Sans · Plex Mono)
src/
  main.js               point d'entrée : instancie App, app.start(), enregistre le SW
  core/
    constants.js        STORAGE_KEY, SCHEMA_VERSION, DAY_MS, PALETTE, DEFAULT_SETTINGS, THEMES…
    EventEmitter.js     on/off/emit (base du Store)
  utils/                datetime · intervals · dom (el/qsa/escapeHtml/createEl) · clipboard · curve · color
  models/               DOMAINE
    Settings.js         réglages + résolution horaires 3 niveaux (voir §5)
    Task.js  Segment.js modèles (fromJSON/toJSON)
    Store.js            SOURCE DE VÉRITÉ : état + commandes + persistance + events
  services/
    Persistence.js      stockage 2 zones : IndexedDB (complet) + miroir localStorage 30 j (§6)
    TimeCalculator.js   temps ouvré (workRangesBetween/workedMs), planifié, agrégats, timeline, trous
    StatsAggregator.js  agrégats rétrospectifs de l'onglet Stats (§10)
    Formatter.js        décimal / Jira / clock(H:mm) / hms ; unités Jira auto (§5)
    DataTransfer.js     export/import JSON, export CSV
    StorageInfo.js      estimation d'occupation (navigator.storage.estimate)
  ui/
    App.js              CONTRÔLEUR : assemble tout, détient l'état d'UI (viewDay, screen), routage
    Timer.js            tick 1 s (EventEmitter)
    DayGlyphAnimator.js anime le glyphe « moment de la journée » image par image
    EyeBreak.js         « repos des yeux » (20-20-20) : état + notification (§13)
    icons.js            pack d'icônes Lucide inline + glyphes dot-matrix (§8)
    components/         Toast · CopyButton · ScheduleEditor · TimelineTip (factories)
    views/              une vue = bind() (1×, optionnel) + render(viewDay) ; voir liste ci-dessous
    modals/             Modal (base) · NewTask · Resume · EditTask
```

Vues (toutes ajoutées à `App.views`) :
`HeaderView, ThemeView, HeroView, TabsView, DayNavView, TimelineView, TotalsView,
TaskListView, SegmentTableView, StatsView, StatsTrendView, StatsHeatmapView,
StatsWeeksView, StatsBreakdownView, StatsTimelineView, AllTasksView,
SettingsView, StorageView, ToolsView`.

### Conventions de vue (à respecter pour toute nouvelle vue)
- Constructeur `(app)` ; récupère ses éléments via `el("id")`.
- `bind()` : câble les écouteurs **une seule fois** (appelé une fois au démarrage).
  Optionnel pour une vue sans interaction (`v.bind?.()` dans `App.start`).
- `render(viewDay)` : (re)dessine à partir de l'état ; **ne crée pas d'écouteurs**.
- **`this.anchor`** = un élément de la région de la vue : `App.render()` **saute**
  les vues dont l'anchor est sous un ancêtre `[hidden]` (autre onglet / écran) ;
  elles sont rendues à la bascule (`TabsView.select()`, `showScreen()`). Les vues
  toujours visibles (header, thème, hero) n'ont pas d'anchor.
- Pas d'état dupliqué : on relit toujours `app.store` au rendu.
- Les vues **ne mutent jamais** l'état : elles appellent des commandes du `Store`
  ou des méthodes de `App`.
- Délégation d'évènements sur un conteneur stable quand le contenu est reconstruit.

### App (contrôleur)
- Détient l'UI-state : `viewDay` (jour affiché) et `screen` (`app|settings|guide|tools`).
- Écrans : `#appScreen` (onglets Journée/Segments/Tâches/Stats) vs `#settingsScreen` /
  `#guideScreen` / `#toolsScreen` (pages pleines, ouvertes via le header). `showScreen()`.
- Onglets gérés par `TabsView` ; le sélecteur de jour (`#dayHead`) est masqué sur
  les onglets « Tâches » et « Stats » (vues tout-temps).
- `statsPeriod` (`4w|3m|12m|all`) est le second état d'UI : la fenêtre d'analyse de
  l'onglet Stats, que **toutes** ses vues suivent (`App.setStatsPeriod`).
- `App.start()` est **async** : rendu instantané (miroir local, retire le squelette
  `body.booting`) → `await store.ready()` (IndexedDB + migration) → câblage des
  interactions → re-render. Voir §6.

## 4. Modèle de données (schéma v12)

```jsonc
{
  "version": 12,
  "settings": {
    "appName": "Stint", "theme": "system",          // system|light|dark
    "workDays": [1,2,3,4,5],                          // 1=lun … 7=dim
    // Une journée se dit partout pareil : arrivée, départ, et une pause OU NON.
    // `lunch` (v11) porte l'état, `lunchStart`/`lunchEnd` la fenêtre.
    "arrival": "08:30", "departure": "17:00",
    "lunch": true, "lunchStart": "12:30", "lunchEnd": "13:30",
    "weekdayHours": { "5": [["08:30","12:50"]] },     // exceptions par jour de semaine
    // Par date ; [] = non travaillé. Une PÉRIODE (des congés) y est stockée
    // **expansée**, une clé par date — pas de 4ᵉ niveau de précédence. Les jours
    // déjà non travaillés sont sautés à l'écriture, et `Settings.dateGroups()`
    // les enjambe pour recoller la période à l'affichage.
    "dateHours": { "2026-06-12": [["08:30","12:30"],["13:30","16:30"]] },
    "jira": { "auto": true, "hoursPerDay": 8, "daysPerWeek": 5 },
    "rounding": "none",                                // none|1m|5m|15m|30m|1h
    "roundedDay": false,                               // vue arrondie de la journée (v7)
    "bgDots": false,                                   // fond réactif au curseur (v5)
    // rappel 20-20-20 (v8) ; `restSeconds` = durée du repos (v9) ;
    // `sound`/`volume` = le bip de synthèse aux deux bords du repos (v10)
    "eyeBreak": { "enabled": false, "minutes": 20, "restSeconds": 20,
                  "sound": false, "volume": 0.5 },
    // rappels de la journée (v10). `lunch`/`dayEnd` n'ont PAS d'heure : elles se
    // déduisent des horaires résolus du jour (§14).
    "reminders": { "lunch": false, "dayEnd": false,
                   "breaks": [{ "id": "r_…", "label": "Pause café",
                                "time": "10:00", "date": null }] },
    // seuils du CHRONO seulement (v12), en minutes, 0 = désactivé : fusion des
    // micro-pauses (reprendre la même tâche dans ce délai rouvre le segment) et
    // segments courts jetés à l'arrêt (`Store.#stopActive`). Une saisie
    // explicite (modale, glisser) n'est jamais jetée.
    "segments": { "mergeGapMin": 2, "minMin": 1 }
  },
  "tasks": [{ "id":"t_…", "name":"…", "type":"dev|support|autre",
              "color":"#…", "link":"https://…|null",   // lien externe optionnel (v6)
              "done":false, "archived":false }],
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

- **Une seule grammaire de saisie, partout** : une **arrivée**, un **départ**, et une
  **pause déjeuner ou non** (`lunch`). C'est vrai de la base comme des deux niveaux
  d'exception — « matin / après-midi » mentait dès qu'on ne travaillait que
  l'après-midi. `blocksFromDay` / `dayFromBlocks` (dans `Settings`) font la
  traduction dans les deux sens ; l'éditeur et les vues n'en fabriquent jamais.
- **3 niveaux**, du plus général au plus spécifique : base (arrivée/départ/pause +
  `workDays`) → `weekdayHours[isoDow]` → `dateHours["YYYY-MM-DD"]`. Résolution dans
  **`Settings.blocksFor(date)`** ; précédence **date > jour de semaine > base**.
  `scheduleFor(date)` est le même calcul **sans** le niveau date : c'est ce que
  lisent l'écriture d'une période et son regroupement, qui ne peuvent pas consulter
  `dateHours` qu'ils sont en train d'écrire.
  Un planning = liste de créneaux `[["HH:MM","HH:MM"], …]` ; `[]` = non travaillé.
  **Invariant** garanti par `mergeBlocks` : créneaux disjoints et croissants. Deux
  créneaux **jointifs** ne sont jamais rendus — ils feraient croire à une pause
  déjeuner qui n'existe pas (`Reminders` teste `ranges.length > 1`) et
  dédoubleraient le trou de `gapsForDay`.
- **Une période n'est pas un niveau** : `setDateRange(from, to, blocks, {replacing})`
  écrit une clé par date ouvrée, `dateGroups()` les recolle à l'affichage. `blocksFor`
  — donc tout `TimeCalculator` — n'en sait rien. `replacing` porte les clés du groupe
  en cours de modification : sans elles, rétrécir une période la dédoublerait.
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

> `DESIGN_SYSTEM.md` est la source de vérité détaillée. Résumé opérationnel ici.

- 5 feuilles : `fonts.css` (@font-face), `variables.css` (jetons + thèmes),
  `base.css` (reset), `layout.css` (structure), `components.css` (composants).
- **Toute la sémantique de couleur est en variables**, chaque jeton défini **une
  seule fois** via `light-dark(clair, sombre)` ; `[data-theme]`
  (`light|dark|system`) ne pilote que `color-scheme`. **Aucune couleur en dur**
  hors `variables.css` (seule exception : le blanc sur un fond minium plein).
- **Trois niveaux de surface, jamais quatre** : page (`--bg`) → panneau
  (`--surface`, une vraie carte avec un cheveu d'ombre) → creux (`--surface-2` :
  pistes, tuiles, champs). Corollaire : un contrôle qui vaut `--surface`
  disparaît dans un panneau `--surface` — pilules, mini-boutons, selects et
  champs **teintent** donc leur hôte (`--ctl`, 7 % d'encre) au lieu de nommer une
  surface.
- **Encre sur papier, un accent, un tampon.** C'est la règle qui tient tout le
  reste. L'app est une pointeuse : il n'y a **pas d'autre teinte** que l'accent
  et le minium (l'ambre et le vert ont été retirés — bleu + orange vibre, et à
  sept directions sur une page dont le sujet est un nombre, la couleur ne
  hiérarchise plus rien).
  - **N1 minium** (`--stop`) : ce qui exige le regard **maintenant**. Quatre
    emplois : le nombre qui tourne **quand il faut le désigner parmi d'autres**
    (durée de la ligne en cours, « en cours » du tableau, décompte du repos), le
    repère « maintenant », l'action irréversible, l'anneau de focus. Il marque
    **le nombre qui bouge**, jamais l'objet qui le contient — d'où l'absence
    totale de liseré de bord. `--stop-ink` pour tout minium de moins de 24 px ;
    `--on-signal` pour le texte posé sur un aplat de minium.
    **Pas le chrono du héros** : il l'a été, et c'était une faute d'échelle — le
    tampon désigne *un* élément parmi plusieurs, or le héros n'en a qu'un. Un
    nombre de 54 px repeint en rouge chaque seconde ne hiérarchise plus rien.
    « Ça tourne » se lit à la pastille qui bat. Règle générale : **plus le nombre
    est gros, moins il a besoin du tampon.**
  - **N2 contraste inversé** (`--inverse-bg` / `--inverse-fg`) : le registre.
    **Deux ancres seulement** — total du jour et tête des Stats — plus le
    sélecteur de jour.
  - **N3 bleu de Prusse** (`--accent`) : tout ce qui se clique **et** tout ce qui
    se mesure, en **deux intensités seulement** (l'aplat, le lavis `--accent-wash`).
    Un seul aplat plein dans toute l'app : **la barre d'onglets**. Tout ce qui se
    sélectionne en dessous se marque en lavis + anneau — et l'anneau est réservé
    au choix *unique* (en sélection multiple il fait un feston).
  - **N4** : `--text` / `--text-soft` / `--text-faint`.
  - **Le manque se dessine en hachures** (`--hatch-img`, 45°), jamais en couleur :
    trous de la timeline, carte « temps non tracé », hors-horaires du brut/net.
    Une absence se dessine, elle ne se peint pas en jaune. **L'acquis** se dit en
    encre, ou par la disparition de la trame.
  - **Les catégories sont trois séries, pas une rampe** : dev garde l'accent,
    `--dot-support` prend une **ocre** (seule dérogation à « un accent, un
    tampon »), `--dot-autre` reste neutre, dérivé vers la surface (vers l'encre,
    il s'inverserait en thème sombre). Une rampe d'une seule teinte suffit tant
    qu'on **empile** ; elle échoue dès qu'on **superpose** (courbes séparées),
    où deux valeurs d'un même bleu qui se croisent ne font plus qu'une ligne.
    Une **teinte de données** ne vit que dans un graphique légendé — jamais sur
    un contrôle ni sur un état — et l'ocre est choisie loin du minium en teinte
    (31° contre 7°) pour que le tampon reste le seul rouge.
  - **Aucune couleur de tâche par défaut ne doit pouvoir passer pour le tampon**
    (`PALETTES.support` est en argile/brique/prune, pas en orange vif).
- **Contraste : tout texte à ≥ 4,5:1** (≥ 3:1 au-delà de 24 px). Les trois encres
  passent le seuil sur les trois surfaces ; elles se ressemblent donc, et c'est
  voulu — la hiérarchie se joue sur la **taille et la casse**, jamais sur la
  pâleur ni sur l'`opacity`. Contrôle automatisé (§9).
- **La perforation** (`.perf`) est le seul ornement de l'app : la bande
  détachable du carnet de pointage, entre l'instrument et le journal (Journée) et
  entre la tête de période et les blocs d'analyse (Stats). Deux emplois, pas plus.
- **Les durées s'alignent.** Dans toute liste, la durée est la **dernière piste
  d'une grille**, collée au bord droit : la colonne élastique (le nom) absorbe les
  variations d'actions et de survol. Dans un compteur de temps, une colonne de
  chiffres qui n'en est pas une trahit tout le reste.
- **Ce qui est déjà visible ne bouge jamais au survol.** Les actions révélées au
  survol sont légitimes ; déplacer au même instant les boutons permanents ne
  l'est pas — on vise une cible qui fuit sous le curseur. Le groupe d'actions
  étant collé à droite, il grandit vers la gauche : les contrôles permanents
  (`ctrl-play/pause/finish`) **ferment donc la file** (`order: 1`), et les
  révélés viennent occuper le vide à leur gauche.
- **Design flat** : pas de bordures structurelles ; on distingue par **surfaces**
  (`--surface`, `--surface-2`) et **espace**. Échelle `--sp-1..7`.
- **Papier chaud le jour, Ardoise la nuit** — jamais de blanc ni de noir purs. Le
  fond porte un **grain** de points (`--grain`, pas 22 px) porté par une **couche
  fixe** (`body::before`), pas par le fond du `<body>` : le fond réactif au
  curseur (`.bg-dots`) est lui aussi `fixed inset:0`, et les deux trames doivent
  partager **la même boîte, le même pas, la même position et le même rayon de
  point**. Même pas mais phases différentes, elles se croisent au lieu de
  s'éclairer — et l'écart bouge au défilement. Modifier l'une = modifier l'autre.
- **Contraste d'échelle** : étiquettes minuscules en capitales, chiffres énormes
  (rapport de 1 à 8 sur une même page). C'est ce qui rend l'info immédiate — pas
  la décoration.
- **Une seule grammaire de barre de part** (piste à 8-10 % d'encre, remplissage
  plein, coins en pilule) pour toute proportion : part d'une tâche, composition
  du jour, couverture, semaines des Stats, stockage.
- **Trois niveaux de surface, jamais quatre**, et jamais de carte dans une carte
  de même fond : page (`--bg`) → panneau (`--surface`) → creux (`--surface-2`).
- **Rayons** resserrés (`--radius-lg` 16 / `--radius` 12 / `--radius-sm` 9 /
  `--radius-xs` 7 / `--radius-pill` 999) : l'app se lit comme un instrument de
  mesure. Les pilules restent pour ce qui se clique.
- **4 polices, 4 emplois** : `--font-display` **Bitcount Grid Single = LES
  CHIFFRES** (et le wordmark) ; `--font-head` **Archivo** (titres) ;
  `--font-body` **IBM Plex Sans** (corps, UI) ; `--font-data` **IBM Plex Mono**
  (surtitres, libellés, axes, plages horaires).
  **Plancher de 16 px sur Bitcount** : en dessous la matrice se referme, on
  bascule sur Plex Mono (qui garde `tabular-nums`). Un contrôle automatique le
  vérifie (§9).
  **Polices auto-hébergées** (aucune requête tierce) : `@font-face` dans
  `assets/styles/fonts.css`, woff2 dans `assets/fonts/`. Archivo, Plex Sans et
  Plex Mono viennent de l'API Google `css2` (pas d'outil de subset embarqué) ;
  Archivo n'embarque que le **latin** (l'UI est française). Les 9 woff2 +
  `fonts.css` sont dans `CORE` (sw.js) ; `plexsans-latin` et `bitcount-latin`
  sont **préchargés** dans `index.html`.
- **Texte sur une couleur de tâche** : la palette est libre, le CSS ne peut donc
  pas décider. `utils/color.js` calcule la luminance, la vue pose `on-dark` /
  `on-light` (seuil 0,198 = point d'équilibre des contrastes WCAG).
- **Couleurs des tâches** : 3 palettes **par catégorie** (`PALETTES` dans
  `constants.js`), rabattues sur les familles du système — dev = froides,
  support = chaudes, autre = neutres chauds. Attribution cyclique
  (`Store.#nextColor(type)`).
- Thème appliqué sans flash par un script inline dans `<head>`. `ThemeView` met à
  jour `<meta name="theme-color">` en lisant le **fond calculé** du body (jamais
  deux hex recopiés : ils se désynchroniseraient de `variables.css`).
- **Ce qui est figé** : les **5 glyphes dot-matrix 7×7** (`play, pause, plus,
  resume, check`) et la **scène « moment de la journée »** (paysage, trajectoire,
  cadrage). Réglés une fois, on n'y revient pas.

## 8. Icônes

- `src/ui/icons.js` : pack **Lucide** vendu en SVG inline (aucun réseau, thémé via
  `currentColor`). `icon(name, {size, solid})` renvoie le balisage.
- **`dotIcon()` et la scène « moment de la journée » sont figés** : les 5 glyphes
  dot-matrix 7×7 (`play, pause, plus, resume, check`) et le paysage soleil /
  montagnes ont été réglés une fois pour toutes. Ne pas les redessiner, ne pas en
  ajouter, ne pas toucher au cadrage de la scène.
- Icônes statiques du HTML : `<span data-icon="name">` rempli par
  `renderStaticIcons()` au démarrage. **Ajouter une icône** = ajouter une entrée
  dans la map `ICONS`.
- **La marque (« le repère ») vit en trois exemplaires à garder synchrones** :
  le SVG inline de l'en-tête (peint aux jetons, donc thémé), `assets/icon.svg`
  (couleurs en dur + `prefers-color-scheme` : un favicon n'a pas le CSS de la
  page) et les trois PNG. Géométrie et pistes écartées : `DESIGN_SYSTEM.md`
  §1 « La marque ».
- **Régénérer les PNG** : rendre le 512 avec Chromium, puis **rééchantillonner**
  le 192 et le 180 depuis ce 512 (décodage/encodage PNG en Python pur, zlib
  suffit). Ne pas demander directement une fenêtre de 192 ou 180 : Chromium
  headless **clampe la hauteur de fenêtre** sous un certain seuil et rend une
  image tronquée à mi-hauteur — sans erreur, et le PNG fait bien la taille
  demandée. Vérifier après coup en décodant le PNG et en mesurant les bornes
  des aplats, pas à l'œil.
- Clic sur un bouton contenant une icône : déléguer via `e.target.closest('[data-…]')`
  (le clic peut viser le `<svg>` enfant).

## 9. Vérifications avant commit (pas de framework de test)

Lancer ces contrôles (rapides, en Node) :
- **Syntaxe** : `for f in $(find src -name '*.js'); do node --check "$f"; done`
- **IDs** : tout `el("x")` du JS doit avoir un `id="x"` dans `index.html`.
- **Icônes** : tout `data-icon="x"` doit exister dans la map `ICONS` (ou dans
  `DOT_GLYPHS` si `data-dot="true"`).
- **CSS** : accolades équilibrées par fichier ; tout `var(--x)` utilisé est défini
  dans `variables.css` ; **aucune couleur en dur** hors `variables.css`.
- **Plancher Bitcount** : aucune règle `--font-display` sous 16 px.
- **Contraste** : à faire **sur le DOM rendu**, pas sur les jetons — le fond réel
  d'un texte dépend des surfaces empilées au-dessus, des opacités d'ancêtres et
  parfois d'un pseudo-élément (le curseur d'onglets). Recette : une page qui
  charge `index.html` dans une `<iframe>`, attend la fin du démarrage, injecte
  `*{transition:none!important;animation:none!important}` dans le document de
  l'iframe (sans quoi on mesure une couleur en cours d'interpolation), puis pour
  chaque élément porteur de texte remonte la chaîne des fonds jusqu'au premier
  opaque et calcule le rapport WCAG. Capturer le rapport avec `--dump-dom`.
  Trois pièges à reproduire : multiplier les `opacity` de tous les ancêtres ;
  n'accepter un `::before`/`::after` comme fond que s'il **couvre** l'élément
  mesuré ; tenir compte de son `transform` (sinon la pilule d'onglet est
  attribuée aux quatre onglets). Seuil : 4,5:1, ou 3:1 au-delà de 24 px.
  **Attendu : zéro défaut**, sur les six écrans et dans les deux thèmes.
- **Service worker** : tout fichier servi est dans `CORE`, et `CORE` ne référence
  aucun fichier disparu.
- **Logique métier** : `node checks/domaine.mjs` — Node ESM, persistance **simulée**
  (objet `{loadSync, init, loadFull, save, clear}`) : migration, résolution
  d'horaires, périodes et regroupement, validation, `plannedMsForDay`,
  `workRangesBetween`, invariant des unités Jira, formats. Sortie non nulle si un
  contrôle échoue. **Y ajouter tout nouveau comportement de domaine.**
  (IndexedDB/DOM ne tournent pas en Node : on teste le domaine, pas le rendu.)
- **Capture : simuler le survol.** Chromium headless annonce `hover: none` et
  `pointer: coarse` — donc toute règle sous `@media (hover: hover)` est ignorée,
  et on photographie la variante tactile en croyant voir le bureau. Ajouter
  `--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4`
  à **toutes** les captures et à l'audit de contraste.
- **Rendu** : servir en HTTP et capturer avec le Chromium préinstallé
  (`--headless --hide-scrollbars --force-prefers-reduced-motion
  --virtual-time-budget`), en **clair et en sombre**. Attention : le service
  worker sert **cache d'abord** — repartir d'un profil vierge, sinon la capture
  montre l'ancienne version.
- **Je ne peux pas juger le rendu autrement** : signaler les changements visuels
  à valider par l'utilisateur (capture clair + sombre).

## 10. Onglet Stats (rétrospective)

Une **seule** agrégation sert les 6 blocs : `StatsAggregator.snapshot(période)` renvoie
un objet **mémoïsé sur `store.rev`** (compteur incrémenté à chaque commit et à chaque
hydratation). Sans lui, chaque bloc rebalaierait l'historique à chaque `App.render()`
(mutation + tick 15 s). Si un segment tourne, la clé de cache inclut la minute courante.

- Tout part de **`calc.segmentMs(seg, from, to)`** : lui seul connaît le brut/net et le
  rognage horaire. On agrège **par jour**, puis on recompose semaines et mois — le temps
  compté est additif sur des jours disjoints, donc la somme des tranches vaut toujours
  le total (propriété couverte par les tests).
- Les semaines du récap sont calculées **entières** (lundi → dimanche) même quand la
  période les coupe, plus une semaine en amont qui sert de base à l'écart.
- Le graphique est un **SVG en pixels réels** (mesure de `clientWidth` au rendu, comme
  l'axe de `TimelineView`) + `ResizeObserver` — pas de `viewBox` étiré, qui déformerait
  l'épaisseur des traits. Lissage **monotone** (`utils/curve.js`) : jamais de dépassement
  sous zéro sur des séries en dents de scie.
- Les marques survolables (colonnes du graphique, pastilles du rythme) réutilisent
  `attachTimelineTip` via son option `selector` et le contrat `data-name/range/dur/color`.

## 11. Pièges déjà rencontrés (à connaître)

- **`box-sizing: border-box` + padding = plancher de largeur invisible.** La
  largeur utilisée d'une boîte `border-box` ne peut pas descendre sous la somme
  de ses paddings. `.tl-seg` portait `padding: 0 15px` : **tout** segment de
  timeline était donc rendu à 30 px minimum, quoi que dise `min-width` et quelle
  que soit sa durée. Mesuré : un segment de 2 min calculé à 0,33 % (3,6 px) sortait
  à 30 px — 14 minutes affichées — et **dépassait le repère « maintenant » de
  26 px**, ce qui est proprement impossible. Sur tout élément dont la largeur
  *porte une donnée*, l'inset du contenu va sur les enfants (marge), jamais en
  padding sur la boîte.

- **Compter des jours en `Math.floor` est faux.** `parseDateInput` rend des minuits
  **locaux** : une plage qui enjambe un changement d'heure ne fait pas un nombre entier
  de jours de 24 h. Du 25 au 31 mars 2026 vaut 5,958 jours — `floor(…)+1` répond 6, il y
  en a 7. `countDays` utilise donc `Math.round`, et `eachDateKey` itère par `addDays`
  (donc `setDate`), jamais par `+= DAY_MS`. `TimeCalculator.workRangesBetween` fait
  encore `cursor += DAY_MS` : son garde-fou `safety < 400` le sauve, mais **ne pas
  recopier ce motif** dans du code neuf.

- **`blocksFor` rend le tableau STOCKÉ, par référence.** Un appelant qui le muterait
  modifierait les réglages sans passer par `#commit()`. Aucun ne le fait — mais
  l'écriture d'une période multiplie le rayon d'explosion : `setDateRange` copie donc
  les créneaux **par clé** (`blocks.map(p => [p[0], p[1]])`), sinon retoucher un
  créneau en retoucherait douze.

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

## 12. Git

- Développer et pousser sur **`master`** (branche de déploiement).
- **Messages de commit en français**, descriptifs (sujet + corps expliquant le
  pourquoi). Garder le style des commits existants.
- Ne pas créer de PR sauf demande explicite.


## 13. Repos des yeux (20-20-20)

`ui/EyeBreak.js` porte **l'état**, `HeroView` le **rend** (bandeau au bas de la
carte de tâche active), `SettingsView` le **règle**. Rien n'est persisté : tout se
déduit des segments et de l'horloge murale.

- **Armé** = réglage actif **et** un chrono qui tourne. `App.render()` appelle
  `sync()` avant les vues, comme `BgDots.setEnabled`.
- **L'écran continu se déduit des segments** (`#runStartMs`) : on remonte la
  chaîne des segments qui se **touchent** (à 2 s près). Changer de tâche ne coupe
  pas la course, une pause si. Ne jamais repartir de l'instant du chargement :
  un rechargement afficherait « 0:00 » après deux heures de travail.
- **La cadence suit cette course** : la prochaine échéance est le **multiple
  suivant** de la période depuis le début de la course. Un rechargement ne
  décale donc pas le repos, et activer le rappel en cours de route le pose au bon
  endroit du rythme.
- **Les deux durées sont réglables** (`eyeBreak.minutes`, `eyeBreak.restSeconds`,
  schéma v9). Elles portent le nom de la règle — 20 et 20 — mais une règle qu'on
  ne peut pas adapter à sa fatigue est une règle qu'on finit par couper. La
  période suivante court à partir de la **fin** du repos : les secondes passées à
  regarder au loin ne sont pas du temps d'écran.
- **Le bandeau se vide pendant le repos** : un balayage (`.eye-sweep`) repeint la
  part **écoulée** de la couleur neutre du bandeau, si bien que le minium se
  retire à mesure. Largeur posée en JS une fois par seconde avec
  `transition: width 1s linear` : les pas se raccordent bout à bout (mouvement
  continu), et sous `prefers-reduced-motion` la transition tombe sans que la
  jauge cesse d'être juste — aucune image-clé à synchroniser avec la durée réglée.
  Le sens n'est pas décoratif : un balayage qui **assombrirait** le fond ferait
  passer le texte sous 4,5:1 (3,6:1 dès 20 % de minium en plus), là où en
  s'éclaircissant le bandeau ne fait que gagner en lisibilité.
- **Le repos a DEUX bords, et les deux se signalent.** La fin n'était aucun
  évènement : `resting` est un `restUntil > now` qui devenait faux tout seul, donc
  personne n'était prévenu — or c'est précisément l'instant où l'on ne regarde pas
  l'écran, et il fallait compter dans sa tête. `EyeBreak.#checkRestEnd()` en fait
  une transition explicite, appelée **avant** le retour anticipé de `tick()`.
  Les deux cas où l'on ne sonne PAS tombent sans code en plus : `toggleRest()`
  (fin au clic) et `sync()` (chrono arrêté) remettent `restUntil` à 0 avant qu'on
  y passe. La notification de fin porte le **même tag** que celle de début : elle
  la remplace au lieu de s'empiler.
- **Trois canaux du même évènement** : la notification système (qui se rate), le
  bandeau (qui ne se rate pas… quand on le regarde) et le **bip**
  (`ui/Chime.js`), seul canal utilisable les yeux ailleurs. Le bandeau reste la
  source de vérité visuelle.
- **Le bip est de la synthèse, pas un fichier** : deux oscillateurs sinus, aucune
  dépendance, rien de plus à précacher. Deux timbres qui doivent se distinguer
  **sans le secours des yeux** : l'appel monte (660 → 880 Hz), la fin descend
  (880 → 660 Hz). Coupé par défaut, volume réglable, plafonné à 0,25 de gain.
  L'`AudioContext` ne démarre que sur un geste utilisateur : `App` le débloque au
  premier `pointerdown` du document, et `Chime.play()` se tait en silence tant
  que rien n'a été touché — le son n'a jamais le droit de casser le rendu.
- **Le bandeau ne disparaît jamais tant que le rappel est activé** : chrono à
  l'arrêt (pause, journée pas commencée), il reste en place, **grisé et inerte**
  (`.idle` + `disabled`). Il disparaissait à la pause et toute la carte sautait —
  ce qui est déjà à l'écran ne bouge pas, exactement comme pour les actions
  révélées au survol. Il n'y a qu'un cas où il n'existe pas : le rappel coupé
  dans les réglages.
- Le bandeau est un **bouton unique à deux sens** : on **prend** le repos tout de
  suite (`startRest`), ou on l'achève s'il court déjà. Il repoussait le prochain
  rappel, et c'était une erreur de lecture — cliquer sur « repos des yeux » veut
  dire « je le prends », pas « plus tard ». On ne perd rien au change : démarrer
  le repos recale la cadence sur sa fin, donc le geste repousse quand même le
  rappel suivant d'une période pleine, mais en ayant fait la pause.
- Testé dans `checks/domaine.mjs` avec un faux `app` (le module ne touche au DOM
  que par `app.hero?.tick?.()`).

## 14. Pauses & rappels de la journée

`ui/Reminders.js` porte **l'état et la boucle**, `TimelineView` les **dessine**,
`SettingsView` les **règle**. Comme le repos des yeux, rien n'est persisté au-delà
du réglage : les échéances déjà tirées vivent en mémoire, le temps d'une journée.

- **Midi et la fin de journée ne se saisissent pas, ils se déduisent.**
  `Settings.blocksFor` connaît déjà les horaires résolus (date > jour de semaine >
  base) : la pause déjeuner **est** le trou entre deux créneaux
  (`ranges[0][1]`), la fin de journée **est** la fin du dernier
  (`ranges.at(-1)[1]`). Ne pas les redemander — `lunchStart`/`departure` ne servent
  qu'à fabriquer les créneaux de base et sont **ignorés** dès qu'une exception
  s'applique ; deux sources pour une même heure finissent toujours par diverger.
- **Un rappel est un repère, pas une coupure.** `workRangesForDay`, `gapsForDay`,
  `workedMs`, `plannedMsForDay` ne sont pas touchés. Retrancher une pause café du
  temps ouvré la transformerait mécaniquement en « trou » (≥ 5 min) à combler
  dans la timeline, ce qui n'a aucun sens.
- **`occurrencesFor(date)` est pure** — aucun DOM, aucun effet. C'est elle que
  lisent la timeline, les réglages et la boucle : une seule définition de « ce
  qui se passe ce jour-là », donc pas de dérive entre ce qu'on voit et ce qui
  sonne. Une pause **sans date** vaut les jours travaillés (`ranges` non vide) ;
  **avec** une date, ce jour-là seulement (une réunion).
- **Sa propre boucle d'une seconde, et c'est obligatoire.** `App.#onTick()` sort
  immédiatement si l'onglet est caché **ou si aucun chrono ne tourne** — or
  « fin de journée » doit précisément tomber quand plus rien ne tourne.
- **Garde-fou veille** : une échéance dépassée de plus de 5 min est **soldée sans
  notifier**, et `start()` adopte de la même façon tout le passé du jour. Ouvrir
  Stint à 15 h ne rejoue pas la pause de 10 h.
- **La clé « déjà tiré » inclut l'HEURE** (`jour|id|at`, cf. `#keyOf`), pas
  seulement l'identifiant. Sans elle, déplacer une échéance en cours de journée
  la condamnait : sa clé étant déjà tirée, elle ne sonnait plus. Et le cas n'a
  rien de théorique — c'est ce qui arrive dès qu'on corrige un rappel, ou qu'on
  saisit à 11 h une exception d'horaire qui déplace midi.
- **`addBreak` renvoie une RAISON d'échec** (`"invalid"`, `"duplicate"`,
  `"full"`), pas `null` : un message unique pour trois causes n'aide personne à
  se corriger. La vue valide sur une copie **avant** de muter — `updateSettings`
  commit, persiste et re-rend tout l'écran, il n'y a pas à payer ça pour une
  saisie refusée. Deux rappels au même instant sont refusés : leurs
  notifications portent le même tag, la seconde effacerait la première.
- **La ligne se clique pour être modifiée**, comme toutes les listes `.ov-item`
  de l'app, et `.editing` (lavis + anneau) dit laquelle — sinon le formulaire en
  dessous parle dans le vide.
- **Le repère de timeline est en encre, jamais en minium** : le tampon ne désigne
  que « maintenant ». Son étiquette est calée par son **bord gauche** sur le
  filet, jamais centrée dessus — centrée, une pastille de 120 px annoncerait sa
  position à 60 px près, soit une demi-heure de flou sur une piste où le pixel
  vaut la demi-minute (même faute que le padding de `.tl-seg`, cf. §11).
- **Seule l'étiquette reçoit le curseur** (`pointer-events` sur `.tl-mark b`, le
  filet reste inerte) : c'est par elle qu'on lit l'heure, via `attachTimelineTip`
  et son `selector` — un `title` natif ne s'afficherait jamais sur un élément
  sans évènements, et c'est le seul recours quand l'étiquette est tronquée ou
  lâchée pour cause de collision. Rendre le filet survolable volerait au segment
  qu'il traverse une bande cliquable, pour une cible d'un pixel. `TimelineTip`
  omet donc le séparateur quand `data-dur` est vide, et la pastille de couleur
  quand `data-color` l'est : un repère est un instant, et n'appartient à aucune
  tâche.
- `.ov-item.brk` **annule le `text-transform: capitalize`** de `.ov-name` : la
  capitale initiale vaut pour un jour de semaine (« lundi » → « Lundi »), pas
  pour un intitulé saisi, qu'elle rendrait en « Pause Café ».
- Les notifications passent par `services/Notifier.js`, partagé avec le repos des
  yeux : un seul endroit connaît la permission, les deux voies d'émission
  (service worker puis `new Notification`) et le repli sur le toast.
- **Le Guide en parle** (`g-7`, « Rappels & repos des yeux »). Son sommaire est
  purement déclaratif — des ancres `#g-N` vers des `.guide-block`, aucun JS :
  ajouter une section, c'est une entrée dans l'`aside` et un bloc dans
  `.guide-content`, avec la renumérotation des deux côtés. Le Guide **tutoie**
  (les réglages vouvoient) ; pour un raccourci, l'élément `<kbd>` est stylé,
  `class="kbd"` ne l'est pas.
