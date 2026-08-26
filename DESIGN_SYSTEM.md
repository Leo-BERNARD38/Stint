# Stint — Design System

> Chronomètre de tâches local-first, prêt pour Jira.
> Système **plat, hiérarchisé, pointilliste** : papier chaud le jour, **Ardoise** la nuit.
> Chaque jeton est défini **une seule fois** via `light-dark()` ; `[data-theme]`
> (`light` | `dark` | `system`) ne pilote que `color-scheme`.

Ce document est la **source de vérité écrite**. `assets/styles/variables.css` en est
l'implémentation ; tout écart entre les deux est un bug de l'un ou de l'autre.

---

## 0 · Principes

1. **Une couleur = une information.** C'est LA règle. L'interface tient sur quatre niveaux
   (§1) et rien d'autre ne porte de couleur. Une teinte qui sert à deux choses ne signale
   plus rien.
2. **Le contraste d'échelle hiérarchise, pas la décoration.** Étiquettes minuscules en
   capitales, chiffres énormes. Le rapport va de 1 à 8 sur une même page — c'est ce qui rend
   l'information immédiate.
3. **Pas de bordures structurelles.** La hiérarchie naît des **surfaces** et de l'**espace**.
   Seuls survivent les filets pointillés (séparateurs) et l'anneau de focus.
4. **Quatre polices, quatre emplois** (§2). Bitcount ne sert qu'aux **chiffres**.
5. **Le temps est tabulaire.** Toute durée en `tabular-nums`, sans exception.
6. **Local-first.** Données dans le navigateur, export JSON/CSV. Installable, hors-ligne,
   sans build ni dépendance.

---

## 1 · Couleurs

### Encre sur papier, un accent, un tampon

C'est le cœur du système, et il tient en une phrase : **l'app est une pointeuse —
de l'encre sur du papier, et un tampon rouge.**

| Niveau | Rôle | Couleur | Où, et **nulle part ailleurs** |
|---|---|---|---|
| **N1** | le tampon | **minium** `--stop` | le nombre qui tourne, le repère « maintenant », l'action irréversible, le focus |
| **N2** | le registre | **contraste inversé** `--inverse-bg` / `--inverse-fg` | total du jour, tête des Stats, sélecteur de jour |
| **N3** | l'accent | **bleu de Prusse** `--accent` | tout ce qui se clique **et** tout ce qui se mesure |
| **N4** | le reste | `--text` / `--text-soft` / `--text-faint` | tout le contenu |

> **Deux ancres inversées, pas trois.** Le total du jour et la tête des Stats. Au-delà,
> l'inversion cesse de hiérarchiser quoi que ce soit.

> **Un seul aplat d'accent plein : la barre d'onglets.** Tout ce qui se sélectionne
> en dessous se marque en **lavis + anneau**. Sans cette distinction, les Stats
> alignaient quatre pilules bleues pleines dans leurs 400 premiers pixels —
> onglet, période, granularité, mode — quatre fois le même signal maximal pour
> quatre niveaux de décision différents.

> **Il n'y a pas d'autre teinte.** L'ambre et le vert ont été retirés (§ *Le
> tampon*). Deux raisons, l'une esthétique et l'autre logique : bleu + orange est
> une paire complémentaire, elle vibre, et une interface qui vibre a l'air d'un
> jouet ; et à sept directions sur une page dont le sujet est un nombre, la
> couleur ne hiérarchise plus rien.

**Deux erreurs à ne pas refaire**, parce qu'elles ont chacune coûté une passe :

- **Un liseré latéral n'est pas un signal.** Trois filets minium de 3 px ont
  marqué un temps « ce qui tourne » (carte du chrono, bouton Pause, ligne
  active). C'est un ornement de bord : il ne dit rien que le contenu ne dise, et
  il casse la silhouette de l'objet. Le minium marque **le nombre qui bouge**,
  pas l'objet qui le contient.
- **Une teinte de tâche ne doit jamais pouvoir passer pour le tampon.** La
  famille « support » était faite d'oranges et de rouges vifs : une tâche de
  support ressemblait à une alarme. Elle est passée en argile, brique et prune.

### Surfaces

| Jeton | Jour | Nuit (Ardoise) | Usage |
|---|---|---|---|
| `--bg` | `#e8e5dc` | `#131211` | fond de page (papier chaud / charbon chaud — jamais du blanc ni du noir purs) |
| `--surface` | `#f7f5f0` | `#1d1b19` | cartes, blocs, champs |
| `--surface-2` | `#eeeade` | `#262320` | zones enfoncées : pistes, sous-blocs |
| `--surface-hover` | `#e2ddcf` | `#302c28` | survol |
| `--skeleton` | `#dcd7c8` | `#2c2825` | placeholder de chargement |
| `--ctl` / `--ctl-hover` | 7 % / 13 % d'encre | idem | fond des contrôles **translucide** |

**Trois niveaux, jamais quatre** : page (`--bg`) → panneau (`--surface`) → creux
(`--surface-2` : pistes, tuiles, champs, sous-blocs). Une carte est une carte —
pas un filet pointillé sur le fond de page.

Corollaire : un contrôle qui vaut `--surface` **disparaît** dans un panneau
`--surface`. Les pilules, mini-boutons, selects et champs de recherche ne
nomment donc pas de surface — ils **teintent leur hôte** (`--ctl`). Une valeur,
aucun cas particulier, et rien à réécrire quand une carte change de fond.
C'est le même piège que la modale avait révélé une première fois.

### Texte, accent, inversion

| Jeton | Jour | Nuit | Usage |
|---|---|---|---|
| `--text` | `#131a20` | `#f2eee3` | texte primaire, afficheurs |
| `--text-soft` | `#475159` | `#aea699` | corps secondaire (≥ 6,4:1) |
| `--text-faint` | `#60666d` | `#948a7e` | légendes, surtitres, axes (≥ 4,6:1) |
| `--accent` | `#1e5273` | `#74b6d9` | **N3** — la seule couleur de ce qui se clique |
| `--accent-text` | `#ffffff` | `#06121c` | texte sur accent |
| `--accent-wash` | `#d9e3e9` | `#1a2c36` | **sa seule variante** (lavis) |
| `--inverse-bg` / `--inverse-fg` | `#131a20` / `#f2efe6` | `#f2eee3` / `#131211` | **N2** |

**Les trois encres passent toutes le seuil AA sur les trois surfaces.** Elles se
ressemblent donc plus qu'avant, et c'est le point : la hiérarchie se joue sur la
**taille et la casse** — un surtitre de 9,5 px en capitales espacées ne se
confond pas avec un nom de tâche de 15 px, même à contraste égal. Elle ne peut
pas se jouer sur la pâleur, parce qu'un texte pâle ne se lit pas, il se devine.
Ne jamais rabaisser `--text-faint` « pour faire discret » : pour faire discret,
on réduit la taille ou on met des capitales, pas le contraste.

**Ne jamais atténuer du texte à l'opacité** non plus : `opacity: .62` sur une
ligne de la pile de précédence la faisait tomber à 2,5:1. Pour reculer un
élément, on lui retire son fond ou on descend d'un cran d'encre.

### Le tampon — et rien d'autre

**L'ambre et le vert ont été retirés.** Bleu + orange est une paire
complémentaire : elle vibre, et une interface qui vibre a l'air d'un jouet. Il ne
reste qu'une teinte hors accent, le minium, et elle n'a que **quatre emplois** :

1. le **nombre qui tourne** — chrono du héros, durée de la ligne en cours,
   « en cours » du tableau des segments, durée dans la liste de reprise ;
2. le repère **« maintenant »** de la timeline ;
3. l'**action irréversible** (purge, suppression) ;
4. l'**anneau de focus**.

Le minium ne marque jamais un objet, il marque **le nombre qui bouge**. C'est
vrai partout, donc ça se reconnaît partout — et aucun liseré de bord n'est
nécessaire pour dire « c'est celle-là qui tourne ».

| Jeton | Jour | Nuit | Emploi |
|---|---|---|---|
| `--stop` | `#cc3823` | `#ff6a4a` | l'aplat, et les grands nombres (≥ 24 px) |
| `--stop-ink` | `#b93320` | `#ff6a4a` | **tout minium de moins de 24 px** |
| `--stop-wash` | `#f6dfd8` | `#3b1d15` | survol d'une action irréversible, uniquement |
| `--on-signal` | `#ffffff` | `#131211` | texte posé sur un aplat de minium |

`--ring` (focus) est un minium à 45 % : le focus se voit, toujours.

### Ce que l'ambre et le vert disaient

**Le manque se dessine en hachures** (`--hatch-img`, 45°). Un trou dans le
registre n'est pas une alerte, c'est une **absence** — et une absence se dessine,
elle ne se peint pas en jaune. Une seule trame pour une seule idée : les trous de
la timeline, la carte « temps non tracé », le hors-horaires du calcul brut/net.

**L'acquis se dit en encre, ou par la disparition du manque.** Journée bouclée =
la carte perd sa trame. Pas besoin de vert pour féliciter : le registre est
plein, ça se voit.

### Types de tâche

**Purement typographiques** : `--type-badge-bg` (encre à 8 %) et
`--type-badge-text` (`--text-soft`), identiques pour les trois. Le mot dit déjà
« dev » ou « support » — lui donner en plus une teinte, c'était trois pastilles
de couleur de plus par ligne pour zéro information supplémentaire.

### Les trois séries de données

`--dot-dev` (l'accent) · `--dot-support` (**une ocre**) · `--dot-autre` (neutre).

La première version était une **rampe** : une seule teinte, trois valeurs — dev /
support / autre n'étant pas des natures opposées mais des **parts d'un même
total**. Le raisonnement tient tant qu'on **empile** : dans une barre ou une aire
cumulée, les bandes se touchent, et deux valeurs voisines se distinguent par leur
frontière. Il tombe dès qu'on **superpose**. En mode « séparé », trois courbes qui
se croisent au milieu d'un cadre ne sont plus séparées par rien : deux valeurs
d'un même bleu deviennent la même ligne, et la lecture qui justifiait le mode
(« le support monte-t-il pendant que le dev descend ? ») devient impossible.

Le support prend donc sa propre teinte. **C'est la seule dérogation à « un
accent, un tampon », et elle est bornée** : une *teinte de données* ne vit que
dans un graphique légendé — jamais sur un contrôle, jamais sur un état. L'ocre
est choisie **loin du minium en teinte** (31° contre 7°, et nettement moins
saturée) : le tampon reste le seul rouge de l'app, et rien de ce qui se lit dans
une rétrospective ne peut passer pour un « maintenant ».

La troisième série reste **neutre** : trois teintes franches feraient trois
sujets sans rapport là où il n'y a qu'un total et ses parts. Elle est dérivée vers
la **surface**, jamais vers l'encre — vers l'encre, elle s'inverserait en thème
sombre.

### Intensité (rythme de Stats)

Cinq paliers `--heat-0..4` **dérivés de `--accent`**, du vide au plein. Jamais de gradient
arc-en-ciel : l'intensité est une seule dimension, elle se lit en une seule teinte.

### La marque — « le repère »

Deux formes, un accent : **une barre souple** (le temps tracé) et **un trait
minium à angles vifs** (l'arrêt). C'est la thèse de l'app en deux rectangles —
un intervalle, et le moment où il s'arrête.

```
 ▭▬▬▬▬▬▬▬▬▬▬▭ ▮      barre : x 5,8 → 21 · h 7,6 · rx 3,8 (pilule pleine)
                     arrêt : x 23 → 26,2 · h 7,6 · rx 1,2 (angles vifs)
```

Ce qui a été écarté, et pourquoi — c'est le plus utile à savoir :

| Piste | Écartée parce que |
|---|---|
| une rangée de trous (la perforation) | se lit comme des **points de suspension** |
| une piste + un segment + un repère | **trois** éléments : illisible à 16 px |
| un intervalle borné à deux caps | dessine un **H**, et l'app commence par un S |
| des colonnes qui montent | se lit comme un **graphique**, pas comme un chrono |
| l'arrêt en pilule, collé à la barre | se lit comme un **interrupteur** |

Les règles qui restent : **deux éléments au maximum** (à 16 px on distingue une
silhouette et un accent, pas davantage) ; **marges gauche et droite égales**
(5,8) pour que la marque ne penche d'aucun côté ; et **aucune lettre**, le
wordmark Bitcount dit déjà le nom juste à côté.

La marque existe en trois exemplaires qu'il faut garder synchrones :

- `index.html` (en-tête) — SVG inline peint avec les **jetons**
  (`var(--text)` / `var(--bg)` / `var(--stop)`) : elle bascule avec le thème
  sans qu'aucune valeur ne soit recopiée ;
- `assets/icon.svg` (favicon) — **couleurs en dur** et `prefers-color-scheme` :
  un favicon n'a pas accès au CSS de la page ;
- `assets/icon-{192,512}.png` + `apple-touch-icon.png` — **plein cadre** sur
  l'encre, contenu à 94 % (rayon maximal 10,2 pour les 12,8 de la zone sûre
  *maskable*).

### Couleur de tâche (libre)

Chaque tâche porte sa couleur (pastille + segment de timeline), attribuée cycliquement
**par catégorie** (`PALETTES` dans `core/constants.js`) et modifiable librement :
dev = froides (bleu de Prusse, sarcelle), support = chaudes (minium, terre, ambre),
autre = neutres chauds. Les teintes sont **rabattues** : saturées, elles cassaient le
papier et arrivaient plus fort que le chrono, qui doit rester le point le plus vif.

Un libellé posé **sur** une couleur de tâche ne peut pas choisir sa couleur en CSS (la
palette est libre) : `utils/color.js` calcule la luminance et la vue pose `on-dark` /
`on-light`. Le seuil (0,198) est le point d'équilibre des contrastes WCAG entre un texte
blanc et un texte encre — calculé, pas tâtonné.

Au point d'équilibre, les deux choix valent ~4,15:1 : il existe donc une bande de
luminance où **aucun** texte ne passe le seuil. Les teintes de `PALETTES` sont
choisies hors de cette bande (cinq d'entre elles ont été décalées de quelques
points pour cela). Une couleur saisie à la main par l'utilisateur peut toujours y
tomber — c'est le prix d'une palette libre, et `color.js` prend alors le meilleur
des deux.

---

## 2 · Typographie

| Jeton | Police | Emploi |
|---|---|---|
| `--font-display` | **Bitcount Grid Single** | **LES CHIFFRES**, et le wordmark. Rien d'autre. |
| `--font-head` | **Archivo** (variable : graisse 400-700, largeur 75-125) | titres de page et de bloc |
| `--font-body` | **IBM Plex Sans** (variable 400-700) | corps, UI, noms de tâche |
| `--font-data` | **IBM Plex Mono** (400 / 500) | surtitres, libellés, axes, plages horaires |

**Plancher de 16 px sur Bitcount.** En dessous, la matrice de points se referme et les
chiffres deviennent illisibles. Tout ce qui passe sous ce seuil bascule sur **Plex Mono**,
qui garde `tabular-nums` et donc l'alignement en colonne. Un contrôle automatique le
vérifie avant chaque commit (§9 de `CLAUDE.md`).

**Archivo n'embarque que le sous-ensemble latin** : l'interface est française et ses titres
sont écrits par l'application, latin-ext n'y sert à rien.

### Échelle de texte

Le rapport entre le plus petit et le plus grand est de **1 à 8 sur une même page**.
C'est lui qui rend l'information immédiate — pas la décoration, et pas la couleur.

| Usage | Taille | Police |
|---|---|---|
| Total de la période (Stats) | clamp(44 → 78) | display |
| Total du jour | clamp(40 → 56) | display |
| Chrono héros | clamp(38 → 54) | display |
| Afficheur du convertisseur | clamp(30 → 46) | display |
| Titre de page | clamp(28 → 38) | head |
| Brut / net (Outils) | 34 | display |
| Format converti | 31 | display |
| Tuile de stats | 29 | display |
| Total de la journée (rail) | 26 | display |
| Durée d'une tâche | 21 | display |
| Ventilation, couverture | 20 / 21 | display |
| Corps | 15 | body |
| Libellé de réglage | 14,5 (gras) + 12,5 | body |
| Surtitre / overline | 9,5–10, `uppercase`, `letter-spacing:.13-.17em` | data |
| Axes, plages horaires | 9,5–11 | data |

---

## 3 · Espacement & rythme

Échelle en **multiples de 4** (`--sp-1` 4 → `--sp-7` 48) ; l'espace fait le travail des
bordures. Gouttière de page `--sp-5`, respiration entre sections `--sp-7`. La gouttière de
scroll est réservée en permanence (`scrollbar-gutter: stable`) : pas de saut entre onglets.
Largeur de contenu **1180 px** (1320 au-delà de 1500 px), Réglages **1000 px**.

---

## 4 · Rayons & élévation

Resserrés par rapport aux « pilules » d'origine : l'app se lit comme un **instrument de
mesure**, pas comme un widget. Les pilules restent pour ce qui se clique.

| Jeton | px | Usage |
|---|---|---|
| `--radius-lg` | 16 | cartes héros |
| `--radius` | 12 | cartes, blocs, gros boutons |
| `--radius-sm` | 9 | sous-blocs, segments de timeline, champs |
| `--radius-xs` | 7 | éléments fins |
| `--radius-pill` | 999 | onglets, chips, nav de jour, boutons ronds |

**Élévation —** plat par défaut. `--shadow-card` est un cheveu, réservé aux cartes qui
doivent décoller du papier ; `--shadow-pop` à ce qui **flotte** : modales, toasts,
infobulles, popover de remplissage.

---

## 5 · Textures & mouvement

- **Grain de papier** (fond de page) : `radial-gradient` de `--grain` (4,5 % d'encre),
  pas 22 px. À la même intensité que les pistes, la trame couvrait toute la page et
  concurrençait le contenu. Porté par une **couche fixe** (`body::before`), pas par
  le fond du `<body>` : le fond d'un body a pour origine le coin haut-gauche du
  **document** et défile avec lui.
- **Fond réactif au curseur** (`BgDots`, optionnel) : une couche `fixed inset:0`
  centrée sur la **fenêtre**. Il doit partager avec le grain **la même boîte, le
  même pas (22 px), la même position et le même rayon de point** — à cette
  condition seulement il *allume* le grain, point par point. Même pas mais phases
  différentes, les deux trames se croisent au lieu de s'éclairer, et l'écart
  change à chaque défilement. Modifier l'une = modifier l'autre.
- **Grille de points** (pistes, timeline, graphiques) : `--dot-grid` (10 %), pas 11 px.
- **Filet pointillé** (séparateurs de lignes) : `1px dotted var(--dot)` (16 %).
- **Perforation** (`.perf`) : la bande détachable du carnet de pointage — une rangée de
  trous de `--perf` (21 %), pas 19 px. C'est le **seul ornement** de l'app, et il porte
  une information : ici on change de registre. Deux emplois, pas plus — entre
  l'instrument et le journal (Journée), entre la tête de période et les blocs
  d'analyse (Stats). En mettre partout la réduirait à une décoration.
- **Graduation horaire** : `--rule-hour` (12 %) toutes les heures, `--rule-hour-maj` (24 %)
  toutes les deux.
- **Glyphes dot-matrix** : SVG grille **7×7**, `r="0.5"` jointifs, `fill` plein. Le set est
  **figé** : `play, pause, plus, resume, check`. Réservés aux 4 boutons d'action et au
  Guide ; le reste de l'UI garde les silhouettes Lucide.
- **Scène « moment de la journée »** : paysage dot-matrix animé image par image en fond de
  la carte Total du jour (`icons.js` §scène + `DayGlyphAnimator`). **Figée** elle aussi :
  géométrie, trajectoire et cadrage sont réglés, on n'y touche pas.

### Mouvement
| Nom | Courbe / durée | Usage |
|---|---|---|
| `livePulse` | 1,9 s, infini | pastille de la tâche en cours — le seul mouvement permanent |
| `dotIn` | éclosion | apparition des glyphes |
| `ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | pilule qui glisse entre onglets |
| `ease-out` | `cubic-bezier(.16,1,.3,1)` | survols, déploiements, grips, popover |

`prefers-reduced-motion` neutralise l'ensemble.

---

## 6 · Composants

### Boutons d'action (les 4)
Cœur de l'app. **74 px de haut**, glyphe dot-matrix à gauche, libellé 15 px et raccourci
en Plex Mono **empilés** contre le glyphe (étirés d'un bord à l'autre, ils faisaient lire
une ligne de tableau). Play/Pause est **un tiers plus large** : c'est l'action qu'on vise
le plus souvent.

Les quatre boutons sont **quatre cartes identiques**. Un seul glyphe porte de la couleur —
celui de Play : dans une rangée où tout se clique, l'accent ne peut plus dire
« cliquable », il dit « celui-là ». Et il dit ce que le bouton va faire : **accent au
repos** (lancer), **minium en marche** (arrêter). Le fond ne bouge pas : un aplat, et même
un lavis, de 340 px faisait de la mise en pause l'élément le plus fort de la page — plus
fort que le chrono qu'elle arrête.

### Carte de tâche active
Quand ça tourne : pastille qui bat (`livePulse`) et chrono en `--stop`. Deux choses, pas
trois, et **aucun filet de bord**. En pause, tout s'atténue.

### Bandeau « repos des yeux »
Un **bandeau, pas une carte** : il vit *dans* la carte de l'instrument, dont il commente
le chrono. Creux (`--surface-2`, le troisième et dernier niveau de surface), une ligne,
et la grammaire de barre de part commune à toute l'app.

Il n'apparaît que si le rappel est actif **et** qu'un chrono tourne. Sinon rien : on ne
réserve pas une bande à l'écran pour une fonction qu'on n'a pas activée, et la carte se
recentre.

**Deux registres, rien entre les deux.**

| | Fond | Contenu | Barre |
|---|---|---|---|
| En attente | `--surface-2` | étiquette mono + écran continu · « dans 12:40 » | petite piste, `--accent` |
| Le repos | `--stop-wash` | *phrase* « Regardez au loin, 6 mètres » · décompte Bitcount | **le bandeau entier** |

Pendant le repos, **le bandeau EST la jauge** : un balayage repeint la part
*écoulée* de la couleur neutre, et le minium se retire à mesure que les secondes
passent. La petite piste est alors masquée en `visibility` — elle ferait doublon,
mais elle garde sa place, pour que le décompte ne bouge pas d'un pixel entre les
deux états.

Le sens du balayage n'est pas un goût : un remplissage qui **assombrit** le fond
fait passer le texte sous 4,5:1 (mesuré à 3,6:1 dès 20 % de minium en plus),
quand l'éclaircissement fait gagner en lisibilité d'un bout à l'autre du repos
(4,7:1 → 4,9:1). Et il dit la même chose que toutes les jauges de l'app : la
couleur montre **ce qui reste**.

Trois règles s'y appliquent, toutes déjà écrites ailleurs :

- **La barre se vide**, avant le repos comme pendant. Elle dit exactement ce que dit le
  nombre posé à sa droite : *ce qu'il reste*. Un remplissage qui monte à côté d'un nombre
  qui descend, ce sont deux lectures pour une seule information.
- **Le tampon pour les vingt secondes seulement.** C'est le seul moment où l'application
  demande quelque chose *maintenant* — donc `--stop`, et le décompte est un nombre qui
  tourne, donc en Bitcount comme tous les nombres qui tournent.
- **Hauteur figée** entre les deux états (`min-height`). Le décompte du repos est plus
  gros que le temps restant ; une bande qui grandit à l'instant du repos ferait sauter
  toute la carte, et rien de ce qui est à l'écran ne bouge sous les yeux.

L'étiquette change de nature avec l'état, et c'est voulu : en attente c'est un **libellé**
(mono, capitales, 9,5 px, on le survole), pendant le repos c'est une **phrase** (corps,
12 px, on la lit).

### Lignes de listes (tâches du jour, onglet Tâches, table Segments)
Grille, jamais flex, et **la durée en dernière piste** — collée au bord droit, à la même
abscisse sur toutes les lignes, quel que soit le nombre d'actions (une tâche avec lien en
a une de plus) et quel que soit l'état de survol. C'est la colonne du nom, la seule
élastique, qui absorbe les variations. Des chiffres tabulaires qui ne s'alignent pas, dans
un compteur de temps, c'est le détail qui trahit tout le reste.

Ne restent visibles que les **contrôles de cycle de vie** ; copie, lien et édition se
révèlent au survol — retirés du flux (`display:none`), pas rendus transparents : masqués
mais présents, ils réservaient 200 px de vide au bout de chaque ligne. Sans survol
possible (tactile), tout reste visible.

La ligne en cours : son fond recule d'un cran et **sa durée passe en `--stop-ink`**.

### Carte « Total du jour »
Contraste **inversé** (N2), scène dot-matrix animée en filigrane plein cadre, total géant
(`clamp(40, 4.6vw, 56)`), puis les deux autres unités de report en Plex Mono : décimal et
Jira. H:mm est la seule des trois qu'on ne colle jamais nulle part — la carte ne pouvait
pas s'arrêter là, et son bas restait vide.
Affiche toujours le **jour réel**, indépendamment du jour sélectionné.

### Onglets segmentés · nav de jour · chips

**Deux étages d'« actif », et un seul aplat plein.**

| Étage | Rendu | Où |
|---|---|---|
| navigation principale | aplat `--accent` + `--accent-text` | la barre d'onglets, et rien d'autre |
| sélection secondaire | **lavis** `--accent-wash` + `--accent` + anneau 1,5 px | chips, jours travaillés, contrôle segmenté, sous-nav des Réglages, interrupteur en pilule |

L'anneau vient de la pile de précédence des horaires : c'est la même idée, « celui-ci
l'emporte ». Il est réservé au choix **unique** — pour une sélection multiple (les jours
travaillés), cinq pilules cerclées côte à côte font un feston : le lavis seul suffit.

La barre d'onglets est **contenue et centrée** (480 px), pas pleine largeur. Étalée sur
toute la colonne, elle pesait autant que le héros au-dessus et que les cartes en dessous —
trois bandes de 1180 px empilées, donc plus de hiérarchie du tout. Ramassée, elle redevient
un contrôle, et le **contraste de largeur** fait le travail que la couleur n'a plus à
faire. Le curseur glisse en `spring`.

Nav de jour = **inversée** (N2), compacte, date en Plex Mono ; à sa droite, ce que la
journée **prévoit** (durée planifiée + créneaux retenus) — sans ce dénominateur, la
couverture et les trous ne se comparent à rien.

Exception : dans la légende du graphe d'évolution, « actif » veut dire « série
affichée », pas « option choisie » — ni lavis ni anneau, l'opacité des séries masquées
suffit.

### Réglages
Grille à deux colonnes : **sous-nav collante** (la section visible s'allume) + contenu.
**Une ligne = un réglage** (`.set-row`) : libellé et explication à gauche, contrôle aligné
à droite. C'est cette colonne de droite qui rend la page lisible. Interrupteurs dessinés
sur l'`input` lui-même (`appearance:none` + `::after`) — le JS ne connaît que `.checked`.
**Un groupe = une carte** : à nu sur le fond de page, les cinq groupes se suivaient sans
frontière, et seuls les titres minuscules disaient qu'on avait changé de sujet.

### Pile de précédence des horaires
Les trois niveaux (base, jour de semaine, date) affichés **pour une date de référence**, le
gagnant cerclé d'encre, plus un **ruban** dessinant le planning retenu à l'échelle. Lecture
pure de `Settings.blocksFor()` : aucune règle n'est réimplémentée dans la vue.

### Outils
**Un outil = une carte.** La saisie du convertisseur **est** l'afficheur (Bitcount). Les
quatre formats sont des cartes copiables, Jira devant sur `--accent-wash`. Le calcul
brut/net **se dessine** : un ruban montre l'intervalle en hachures et, par-dessus, les
portions comptées en encre (`TimeCalculator.workRangesBetween`).

### Stats
**Une tête de période, pas deux rangées** : le bandeau inversé et ses cinq tuiles vivent
dans une seule carte. Séparés, ils se lisaient comme deux blocs de poids égal, et la
question « alors, cette période ? » restait sans réponse.

Le bandeau : total en Bitcount jusqu'à **78 px** à gauche ; à droite l'écart en pastille
et la **composition de la période** (barre empilée + légende). Sans elle, l'aplat inversé
était vide aux deux tiers, et la ventilation par type n'apparaissait qu'en bas de page.
Sur fond inversé la barre se nuance en `currentColor` : les couleurs de type y seraient
illisibles.

Les cinq tuiles reculent d'un cran (`--surface-2` dans la carte). Seule « Couverture »
porte une jauge — c'est la seule des cinq qui soit une **part** ; sur une durée ou un
compteur, une barre ne voudrait rien dire.

### Barres de part
Une seule grammaire pour toute proportion, quel que soit l'écran : piste en encre à 8-10 %,
remplissage plein, coins en pilule. Emplois : part d'une tâche dans la journée, composition
du jour (rail Totaux), couverture du jour, semaines des Stats, jauge de couverture,
composition de la période, occupation du stockage.

### Champs de formulaire
Pas de bordure : le fond enfoncé suffit. Focus = anneau minium. Select au chevron maison.
Saisie de données (`.tinput`) en Plex Mono. Jours travaillés = pilules.

---

## 7 · Timeline & temps (RÈGLES MÉTIER)

### 7.1 Fenêtre & modèle horaire
- **Fenêtre d'affichage** : calculée par `TimeCalculator.timelineWindow(day)` — les plages
  ouvrées du jour, **élargies** aux segments qui débordent (nuit, heures sup). Pas de
  bornes fixes.
- **Horaires ouvrés** sur **3 niveaux** (§ Réglages) : base (`arrival` / `lunchStart` /
  `lunchEnd` / `departure` + `workDays`) < `weekdayHours[isoDow]` < `dateHours["YYYY-MM-DD"]`.
  Le plus spécifique **défini** l'emporte ; `[]` = jour non travaillé.
- **Bande déjeuner** : superposition `--lunch-overlay` sur l'intervalle entre deux plages,
  nommée « pause » en Plex Mono quand elle est assez large.
- **Graduation** : un filet par heure dans la piste, et une **règle graduée sous la piste**
  (un trait par heure, plus haut toutes les deux). La règle est *sous* la piste parce que
  les blocs couvrent tout dès qu'une journée est bien remplie.
- **Repère « maintenant »** : trait 2 px `--stop` + pastille d'heure, recalée sur le bord
  quand elle s'en approche (la piste est en `overflow:hidden`).

### 7.2 Temps « ouvré » vs « brut »
- Par défaut, Stint ne compte que le temps **dans les horaires** (pause comprise) → temps
  **ouvré**. Un chrono oublié du vendredi au lundi ignore le week-end.
- La case **`brut`** d'un segment **désactive le rognage** → temps réel écoulé.
- `workRangesBetween(s, e)` rend les portions comptées ; `workedMs()` en est la somme. Le
  ruban des Outils et le calcul partagent donc exactement la même règle.

### 7.2 bis Un segment ne grossit jamais ce qu'il montre
Sur une piste d'un millier de pixels pour huit à treize heures, **un pixel vaut une
demi-minute**. Un bloc dessiné plus large que sa durée fait mentir la piste — et,
quand le segment est en cours, le fait **dépasser le repère « maintenant »**, ce qui
est proprement impossible et se voit tout de suite.

Le plancher est donc en **pixels, en CSS** (`.tl-seg { min-width: 3px }`, de quoi
ne pas disparaître) ; le garde-fou JS ne sert qu'à ne jamais écrire `width: 0%` et
doit rester **sous** ce plancher. Et surtout : **aucun padding horizontal sur
`.tl-seg`** — avec `box-sizing: border-box`, le padding impose un plancher de
largeur qui ignore `min-width` (cf. CLAUDE.md §11). L'inset qui dégage le texte
des poignées vit sur les libellés, en marge.

### 7.3 Segments — édition directe sur la timeline
- Un **segment** = `{ taskId, start, end, raw }` ; `end:null` = en cours.
- Chaque segment porte **son nom et sa durée à l'intérieur** dès qu'il est assez large
  (7,5 % de la piste pour le nom, 12 % pour la durée). En dessous, rien : un texte rogné au
  milieu d'un mot ne vaut pas mieux que pas de texte.
- **Poignées** sur chaque bord (15 px, `touch-action:none`) ; le segment en cours n'a que
  la poignée gauche. **Snap à 5 min**, contraint par les voisins et les bornes d'horaires.
- Pendant un glisser, `render()` est court-circuité : un seul rebuild propre au relâchement.

### 7.4 Temps non tracé (les « trous »)
**Calcul —** tout intervalle libre **≥ 5 min** dans les plages ouvrées, borné à *maintenant*
pour le jour courant (`gapsForDay`).

**Sur la timeline —** zone cliquable **ambre dès le repos** (`--pause-wash` + filet), label
`+ durée` si large. C'est une invitation, pas un détail à découvrir au survol.

**Popover de remplissage** (clic sur un trou) : prolonger le segment de gauche, prolonger
celui de droite, ou créer un segment qui remplit exactement le trou. Chaque action ferme le
popover et confirme par un toast.

**Bloc latéral « Temps non tracé » —** carte **ambre** à gros chiffre, liste des trous avec
bouton `Combler`, et passage au **vert** quand il n'y a plus rien à combler.

**Couverture —** juste en dessous : la part de la journée **planifiée** effectivement
tracée (`plannedMsForDay`). Pourcentage en Bitcount, piste, et les deux termes du rapport
en clair. Masquée les jours non travaillés (sans dénominateur, une barre vide raconterait
un retard imaginaire) ; la piste plafonne à 100 %, le pourcentage dit la vérité.

---

## 8 · Copie & format Jira (RÈGLES)

Partout, **deux formats copiables** (toast de confirmation) :
- **Décimal** — heures à 2 décimales (`1.5`).
- **Jira** — unités `w / d / h / m`. En mode auto, `1d` = durée ouvrée de la journée de
  base et `1w` = nombre de jours travaillés ; sinon, les valeurs saisies.

L'**affichage** des durées est en `H:mm` (`Formatter.clock`) ; la **copie** reste en décimal
et en Jira. Ne pas confondre les deux.

Points de copie : par tâche, par segment, par groupe (récap Jira `nom — durée`), par
semaine, dans le convertisseur et dans le calcul brut/net.

---

## 9 · Navigation & écrans

- **Onglets de contenu** : Journée · Segments · Tâches · Stats.
- **Écrans plein** : App, **Réglages**, **Guide**, **Outils** — ouverts depuis le header.
- **Header collant** translucide, wordmark Bitcount, pastille de sauvegarde, icônes
  Thème / Outils / Guide / Réglages.
- **Stats** : rétrospective pilotée par une **fenêtre d'analyse** unique (4 semaines ·
  3 mois · 12 mois · Tout) que tous les blocs suivent — bandeau de tête, cartes, évolution
  (aires empilées ou courbes séparées, lissage monotone), rythme (pastilles, 5 paliers),
  semaine par semaine (dépliable), répartition, top tâches, historique.

---

## 10 · Accessibilité & garde-fous

- **Contraste ≥ 4,5:1 pour tout texte** (≥ 3:1 au-delà de 24 px), vérifié sur le DOM
  **rendu** et non sur les jetons : le fond effectif se calcule en remontant les surfaces,
  opacités d'ancêtres et pseudo-éléments compris (cf. CLAUDE.md §9). Zéro défaut sur les
  six écrans, dans les deux thèmes — c'est un état à maintenir, pas un objectif atteint
  une fois.
- Ne jamais atténuer du texte à l'`opacity`, ni rabaisser `--text-faint` « pour faire
  discret » : pour reculer un élément, on réduit sa taille, on passe en capitales, ou on
  lui retire son fond.
- Anneau de focus minium visible partout ; cibles tactiles ≥ 30 px, ≥ 44 px pour les
  actions principales.
- `prefers-reduced-motion` coupe l'ensemble des animations.
- `tabular-nums` obligatoire sur toute durée.
- Texte sur couleur de tâche : classe `on-dark` / `on-light` calculée (§1).
- `[hidden]` est neutralisé globalement (`base.css`) : un élément `hidden` avec un
  `display:flex` resterait visible sinon.
- `color-scheme` suit `[data-theme]`, y compris forcé en inline pour la PWA installée.
