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

### La hiérarchie à quatre niveaux

C'est le cœur du système. Avant, `--accent` **valait** `--text` : l'onglet actif, le
sélecteur de jour, le total du jour, la barre de stockage et le rythme des Stats portaient
tous le contraste maximal. Quand tout crie, plus rien ne guide.

| Niveau | Rôle | Couleur | Où, et **nulle part ailleurs** |
|---|---|---|---|
| **N1** | l'instant | **minium** `--stop` | chrono en marche, filet de la carte active, repère « maintenant », danger |
| **N2** | le registre | **contraste inversé** `--inverse-bg` / `--inverse-fg` | total du jour, tête des Stats, sélecteur de jour |
| **N3** | le cliquable | **bleu de Prusse** `--accent` | onglets, chips, boutons primaires, glyphes des 4 boutons, liens, rampe du rythme |
| **N4** | le reste | `--text` / `--text-soft` / `--text-faint` | tout le contenu |

> **Deux ancres inversées, pas trois.** Le total du jour et la tête des Stats. Au-delà,
> l'inversion cesse de hiérarchiser quoi que ce soit.

Trois teintes de service complètent l'ensemble, et ne sortent jamais de leur rôle :

| Teinte | Jeton | Dit |
|---|---|---|
| minium | `--stop` | ce qui se passe **maintenant**, et ce qui s'arrête |
| ambre | `--pause` | ce qui **manque** (temps non tracé, pause) |
| vert | `--play` / `--finish` | ce qui est **acquis** (journée bouclée, tâche terminée) |

### Surfaces

| Jeton | Jour | Nuit (Ardoise) | Usage |
|---|---|---|---|
| `--bg` | `#e8e5dc` | `#131211` | fond de page (papier chaud / charbon chaud — jamais du blanc ni du noir purs) |
| `--surface` | `#f7f5f0` | `#1d1b19` | cartes, blocs, champs |
| `--surface-2` | `#eeeade` | `#262320` | zones enfoncées : pistes, sous-blocs |
| `--surface-hover` | `#e2ddcf` | `#302c28` | survol |
| `--skeleton` | `#dcd7c8` | `#2c2825` | placeholder de chargement |

### Texte, accent, inversion

| Jeton | Jour | Nuit | Usage |
|---|---|---|---|
| `--text` | `#131a20` | `#f2eee3` | texte primaire, afficheurs |
| `--text-soft` | `#5c6873` | `#a79f92` | corps secondaire |
| `--text-faint` | `#8d97a0` | `#726b61` | légendes, placeholders |
| `--accent` | `#1e5273` | `#74b6d9` | **N3** — la seule couleur de ce qui se clique |
| `--accent-text` | `#ffffff` | `#06121c` | texte sur accent |
| `--accent-soft` / `--accent-wash` | `#4b7f9e` / `#d9e3e9` | `#4d87a5` / `#1a2c36` | variantes (reprise, fonds doux) |
| `--inverse-bg` / `--inverse-fg` | `#131a20` / `#f2efe6` | `#f2eee3` / `#131211` | **N2** |

### Teintes de service

| Jeton | Jour | Nuit | Wash (jour / nuit) |
|---|---|---|---|
| `--stop` | `#d8402b` | `#ff6a4a` | `#f6dfd8` / `#3b1d15` |
| `--pause` | `#b8781a` | `#e5a93f` | `#f0e2c4` / `#382b12` |
| `--play` = `--finish` | `#3f7a4e` | `#63b473` | `#d9e7d9` / `#182f1d` |
| `--new` = `--accent` · `--resume` = `--accent-soft` | — | — | — |

`--ring` (focus) est un minium à 45 % : le focus se voit, toujours.

### Types de tâche

Dérivés, jamais recopiés : `dev` → `--accent-wash` / `--accent`, `support` →
`--stop-wash` / `--stop`, `autre` → `--text` à 8 % / `--text-soft`.

### Intensité (rythme de Stats)

Cinq paliers `--heat-0..4` **dérivés de `--accent`**, du vide au plein. Jamais de gradient
arc-en-ciel : l'intensité est une seule dimension, elle se lit en une seule teinte.

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

| Usage | Taille | Police |
|---|---|---|
| Total de la période (Stats) | clamp(40 → 68) | display |
| Chrono héros | clamp(38 → 52) | display |
| Total du jour | 46 | display |
| Afficheur du convertisseur | clamp(30 → 46) | display |
| Titre de page | clamp(28 → 38) | head |
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
  concurrençait le contenu.
- **Fond réactif au curseur** (`BgDots`, optionnel) : **même pas de 22 px** — il éclaire ce
  grain au lieu d'y superposer un second réseau (moiré assuré sinon).
- **Grille de points** (pistes, timeline, graphiques) : `--dot-grid` (10 %), pas 11 px.
- **Filet pointillé** (séparateurs) : `1px dotted var(--dot)` (16 %).
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
Cœur de l'app. **74 px de haut**, glyphe dot-matrix à gauche en `--accent`, libellé 15 px,
raccourci en Plex Mono. Play/Pause est **un tiers plus large** : c'est l'action qu'on vise
le plus souvent. En marche, il devient **plein minium** — comme la carte à côté. Au repos,
carte neutre : le vert ne dit qu'une chose ici, « c'est acquis ».

### Carte de tâche active
Quand ça tourne : filet minium de 3 px au bord gauche, pastille qui bat (`livePulse`),
chrono en `--stop`. En pause, tout s'atténue.

### Carte « Total du jour »
Contraste **inversé** (N2), scène dot-matrix animée en filigrane plein cadre, total géant.
Affiche toujours le **jour réel**, indépendamment du jour sélectionné.

### Onglets segmentés · nav de jour · chips
Onglets et chips actifs = `--accent` (N3). Nav de jour = **inversée** (N2), date en Plex
Mono. Le curseur glisse en `spring`.

### Réglages
Grille à deux colonnes : **sous-nav collante** (la section visible s'allume) + contenu.
**Une ligne = un réglage** (`.set-row`) : libellé et explication à gauche, contrôle aligné
à droite. C'est cette colonne de droite qui rend la page lisible. Interrupteurs dessinés
sur l'`input` lui-même (`appearance:none` + `::after`) — le JS ne connaît que `.checked`.

### Pile de précédence des horaires
Les trois niveaux (base, jour de semaine, date) affichés **pour une date de référence**, le
gagnant cerclé d'encre, plus un **ruban** dessinant le planning retenu à l'échelle. Lecture
pure de `Settings.blocksFor()` : aucune règle n'est réimplémentée dans la vue.

### Outils
La saisie du convertisseur **est** l'afficheur (Bitcount). Les quatre formats sont des
cartes copiables, Jira devant sur `--accent-wash`. Le calcul brut/net **se dessine** : un
ruban montre l'intervalle en hachures et, par-dessus, les portions comptées en encre
(`TimeCalculator.workRangesBetween`).

### Stats
**Bandeau de tête** en contraste inversé : total de la période en Bitcount jusqu'à 68 px +
écart en pastille. Les cinq autres indicateurs reculent d'un cran.

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

- Anneau de focus minium visible partout ; cibles tactiles ≥ 30 px, ≥ 44 px pour les
  actions principales.
- `prefers-reduced-motion` coupe l'ensemble des animations.
- `tabular-nums` obligatoire sur toute durée.
- Texte sur couleur de tâche : classe `on-dark` / `on-light` calculée (§1).
- `[hidden]` est neutralisé globalement (`base.css`) : un élément `hidden` avec un
  `display:flex` resterait visible sinon.
- `color-scheme` suit `[data-theme]`, y compris forcé en inline pour la PWA installée.
