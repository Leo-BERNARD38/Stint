# Stint — Design System

> Chronomètre de tâches local-first, prêt pour Jira.
> Système **plat, monochrome, pointilliste** — raffinage *Nothing OS*.
> Thème sombre de référence ; clair/système dérivés via `light-dark()` piloté par `[data-theme]`.

Ce document est la **source de vérité écrite**. Les deux maquettes l'appliquent :
- `Stint Design System.dc.html` — galerie vivante des jetons & composants.
- `Stint App.dc.html` — l'application complète (référence d'implémentation).

---

## 0 · Principes

1. **Pas de bordures structurelles.** La hiérarchie naît du **contraste de surface** et de l'**espace**, jamais d'un trait. Seuls survivent : filets pointillés (séparateurs) et anneau de focus.
2. **Monochrome d'abord.** L'interface est grise. La couleur ne sert qu'à **distinguer une tâche** ou **signaler un état** (play/pause/non-tracé). Jamais décorative.
3. **Langage de pilules.** Boutons, chips, badges, nav : rayon plein. Le curseur actif **glisse en ressort** entre les options.
4. **Deux polices, strictement.** Une police « caractère » dot-matrix qui *signe* ; une grotesque qui *informe*.
5. **Le temps est tabulaire.** Toute durée s'affiche en `tabular-nums` pour s'aligner colonne par colonne.
6. **Local-first.** Données dans le navigateur ; export JSON/CSV. Installable, hors-ligne.

---

## 1 · Couleurs

Sémantique définie **une seule fois** via `light-dark()`, pilotée par `[data-theme]`. Valeurs **sombres** ci-dessous.

### Surfaces — profondeur par couches
| Jeton | Hex | Usage |
|---|---|---|
| `--bg` | `#0C0C0E` | Fond de page, champs enfoncés |
| `--surface` | `#161619` | Cartes, blocs, header |
| `--surface-2` | `#1F1F23` | Sous-blocs, pistes, boutons défaut |
| `--surface-hover` | `#222227` | Survol des surfaces interactives |

### Texte & accent
| Jeton | Hex | Usage |
|---|---|---|
| `--text` | `#F3F3F5` | Texte primaire, afficheurs |
| `--text-soft` | `#A6A6AE` | Corps secondaire, libellés |
| `--text-faint` | `#6B6B74` | Légendes, suréchantillons, placeholders |
| `--accent` | `#F3F3F5` | Accent primaire (**réglable** — pilote l'état actif des chips/onglets ; la lisibilité du texte s'adapte par luminance) |

### Couleurs d'état — seule entorse au monochrome
| État | Hex | Rôle |
|---|---|---|
| `play` | `#25B35C` | Démarrer / en cours (vert) |
| `pause` | `#E8941F` | Pause **et temps non tracé** (orange) |
| `stop` | `#F0584D` | Danger / supprimer (rouge) |
| `new` | `#5B8BFF` | Nouvelle tâche (bleu) |
| `resume` | `#9B78FF` | Reprise (violet) |
| `finish` | `#2DD4BF` | Terminer (turquoise) |

> **Règle d'usage —** `new / resume / finish` sont réservés aux **glyphes et accents** (icônes du Guide, points de tâche), jamais en fond plein de grande surface. `play / pause / stop` peuvent porter un fond. Cible : clarté/chroma perçue homogène (raisonner en OKLCH) pour qu'aucune ne « crie » plus fort.

### Types de tâche — badge teinté (fond + texte) + point
| Type | Fond badge | Texte badge | Point |
|---|---|---|---|
| `dev` | `#1B3052` | `#9CC0FF` | `#5B8BFF` |
| `support` | `#4D1F1F` | `#FF9F9F` | `#F0584D` |
| `autre` | `#26262B` | `#A6A6AE` | `#6B6B74` |

### Intensité (rythme de Stats)
Cinq paliers `--heat-0..4` **dérivés de `--accent`**, du vide au plein — jamais de gradient
arc-en-ciel : l'intensité est une seule dimension, elle se lit en une seule teinte.

| Palier | Valeur | Sens |
|---|---|---|
| `--heat-0` | `--text` à 7 % | rien de tracé ce jour-là |
| `--heat-1` | `--accent` 26 % sur `--surface-2` | < 25 % de la journée planifiée |
| `--heat-2` | `--accent` 48 % sur `--surface-2` | < 50 % |
| `--heat-3` | `--accent` 72 % sur `--surface-2` | < 80 % |
| `--heat-4` | `--accent` | ≥ 80 % |

### Couleur de tâche (libre)
Chaque tâche porte une **couleur propre** (point carré arrondi + segment de timeline). Palette suggérée dans l'éditeur, plus sélecteur libre :
`#5B8BFF · #F0584D · #2DD4BF · #9B78FF · #E8941F · #25B35C · #F3F3F5`

---

## 2 · Typographie

| Rôle | Police | Détails |
|---|---|---|
| **Display** `--font-display` | **Bitcount Grid Single** (dot-matrix) | Wordmark, titres de section, **chronomètre**, total du jour, nombres de stats. **Jamais sous 16 px** (illisible). |
| **Corps** `--font-body` | **Inter** (400/500/600/700) | Toute l'UI : libellés, corps, champs, boutons. `tabular-nums` partout où une durée s'aligne. |

**Règle de pairage —** jamais d'Inter pour un afficheur de durée ; jamais de dot-matrix sous 16 px. La police « caractère » signe ; Inter informe.

### Échelle de texte
| Usage | Taille | Police |
|---|---|---|
| Afficheur (chrono héros) | clamp(40→56) | display |
| Total du jour | 46 | display |
| Titre de page (Réglages/Guide) | 24–25 | display |
| Titre de bloc | 17 | display |
| Corps | 15 | body |
| Libellé | 13 | body |
| Suréchantillon / overline | 11, `uppercase`, `letter-spacing:.06em`, `600` | body |

---

## 3 · Espacement & rythme

Échelle en **multiples de 4** ; l'espace fait le travail des bordures.

| Jeton | px |
|---|---|
| `sp-1` | 4 |
| `sp-2` | 8 |
| `sp-3` | 12 |
| `sp-4` | 16 |
| `sp-5` | 24 |
| `sp-6` | 32 |
| `sp-7` | 48 |

**Extérieurs —** gouttière de page `clamp(18→40px)` (app) / `clamp(20→56px)` (galerie) ; respiration entre blocs `sp-7` (48) ; entre sections **80 px**. La gouttière de scroll est réservée en permanence (pas de saut entre onglets). Largeur de contenu max **1180 px**.

---

## 4 · Rayons & élévation

Rayons volontairement proches ; les petits éléments deviennent des **pilules pleines**.

| Jeton | px | Usage |
|---|---|---|
| `--radius` | 18 | Cartes (le héros de l'app monte à 20–22) |
| `--radius-sm` | 14 | Sous-blocs, **segments de timeline**, champs |
| `--radius-xs` | 11 | Champs fins, **zones de trou** (gap) |
| `--radius-pill` | 999 | Pilules, chips, boutons ronds, nav |

**Élévation —** plat par défaut, **aucune ombre**. `--shadow-pop` = `0 12px 40px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.4)` réservé à ce qui **flotte** : modales, toasts, infobulles, **popover de remplissage**.

---

## 5 · Textures & mouvement

Signatures *Nothing* — tout est neutralisé par `prefers-reduced-motion`.

- **Grille de points** (pistes/timeline) : `radial-gradient(circle, rgba(243,243,245,.09) 1.1px, transparent 1.3px)` ; `background-size:11px 11px` (10px dans les pistes denses de Stats).
- **Filet pointillé** (séparateurs) : `1px dotted rgba(243,243,245,.24)` (`.16` en sommaire/tableaux).
- **Anneau de focus** : `box-shadow:0 0 0 3px rgba(255,255,255,.35)` — toujours visible, jamais d'`outline` natif.
- **Glyphes dot-matrix** : SVG grille `7×7`, `r="0.5"` jointifs, `fill` plein. Set : `play, pause, plus (new), check (finish), resume`.

### Mouvement
| Nom | Courbe / durée | Usage |
|---|---|---|
| `dotIn` | éclosion | Apparition des glyphes |
| `floaty` | 2.4 s | Flottement léger |
| `spring` | `cubic-bezier(.34,1.56,.64,1)` | Pilule qui glisse entre onglets |
| `ease-out` | `cubic-bezier(.16,1,.3,1)` | Survols, déploiements, grips, popover |

---

## 6 · Composants

### Boutons d'action (les 4)
Cœur de l'app : 4 gros boutons, rayon 20. Glyphe dot-matrix à gauche, libellé, **raccourci clavier** en pilule.
- **Play / Pause** `Espace` — porte la couleur d'état : `play #25B35C` à l'arrêt → `pause #E8941F` en cours (point pulsé).
- **Nouvelle tâche** `N` — neutre (`--surface`).
- **Reprise** `R` — neutre.
- **Terminer** `T` — neutre.

### Boutons standard
Primaire (`--text` sur fond, texte `--bg`) · Défaut (`--surface-2`) · Danger (texte `stop`, pas de fond) · Ghost (transparent + filet interne `rgba(243,243,245,.06)`).

### Boutons icône & mini
Ronds 30–37 px (`--surface`/`--surface-2`), survol → `--surface-hover`. Mini-pilules pour Déc./Jira/Copié.

### Onglets segmentés
Piste en pilule (`--surface`), **curseur plein** (`--accent`/`--text`) qui glisse en `spring`. Onglets app : **Journée · Segments · Tâches · Stats**. Même motif pour Réglages (Système/Clair/Sombre ; De base/Par jour/Par date).

### Nav de jour
Pilule **inversée** (fond `--text`, texte `--bg`), chevrons ronds, date centrée en `tabular-nums`.

### Chips de filtre
Pilules ; actif = `--accent`, inactifs `--surface-2` à `opacity:.5`. Point de couleur de type/tâche à gauche.

### Badges & jetons texte
Pilules `uppercase` 10.5 px : type de tâche, `terminé`, mode `brut`, raccourcis clavier, pastille « Sauvegardé ».

### Champs de formulaire
**Pas de bordure** : fond enfoncé `--bg` suffit. Focus = anneau. Select au chevron maison. Jours travaillés = pilules (`--text` actif / `--bg` inactif). Interrupteur = case carrée `--text` cochée.

### Cartes
- **Tâche active** : point pulsé + halo, nom, badge, chrono dot-matrix.
- **Héros « Total aujourd'hui »** : contraste **inversé** (fond `--text`), glyphe dot-matrix animé en filigrane, chrono géant. Affiche toujours le jour réel (indépendant du jour sélectionné).
- **Stat** : grand nombre dot-matrix + overline.

---

## 7 · Timeline & temps (RÈGLES MÉTIER)

### 7.1 Fenêtre & modèle horaire
- **Fenêtre d'affichage** de la timeline : **08:00 → 18:30** (`WIN0 = 480`, `WIN1 = 1110` minutes). Graduations 9h · 11h · 13h · 15h · 18h.
- **Horaires ouvrés** (réglables — *De base / Par jour / Par date*) : par défaut arrivée **09:00**, **pause 12:30–13:30**, départ **17:30**.
- **Bande déjeuner** affichée en **superposition sombre** `rgba(12,12,14,.5)` sur l'intervalle de pause (750–810).
- **Trait *maintenant*** : ligne 2 px `--text` + point pulsé.

### 7.2 Temps « ouvré » vs « brut »
- Par défaut, Stint ne compte que le temps **dans les horaires** (pause comprise) → temps **ouvré**. Un chrono oublié du vendredi au lundi ignore le week-end.
- La case **`brut`** d'un segment **désactive le rognage** → on compte le temps réel écoulé (session de nuit, heures sup).

### 7.3 Segments — édition directe sur la timeline
- Un **segment** = `{ taskId, start, end, raw }` ; `end:null` = en cours.
- **Poignées (grips)** sur chaque bord : `cursor:ew-resize`, larges de 15 px, `touch-action:none`. Le segment **en cours** n'a **que la poignée gauche** (sa fin = *maintenant*).
- **Snap à 5 min.** Contraintes au drag : bornes des segments voisins, frontière de **déjeuner** (un segment d'avant-midi ne franchit pas 12:30 ; un segment d'après-midi ne descend pas sous 13:30), `WORK_START`, et *maintenant*.
- **Infobulle de drag** : pilule `--text` flottante au-dessus du bord, `HH:MM · durée`.
- Les segments restent aussi **éditables en table** dans l'onglet *Segments* (début/fin en `time`, tâche en select, case brut, durée, copier, supprimer, ajout manuel).

### 7.4 Temps non tracé (les « trous »)
**Calcul —** on fusionne `segments + bande déjeuner`, et tout intervalle libre **≥ 5 min** entre `WORK_START` et *maintenant* devient un **trou**.

**Sur la timeline —** chaque trou est une **zone cliquable** en pointillé : fond `rgba(243,243,245,.045)`, filet `inset 0 0 0 1px rgba(243,243,245,.16)`, label `+ durée` (si large). Survol/actif → teinte **`pause #E8941F`**.

**Popover de remplissage** (clic sur un trou → carte flottante `--shadow-pop`, rayon 18, ancrée au trou ; en mobile : feuille basse + fond assombri) :
1. **Prolonger le segment de gauche** → son `end` s'étend jusqu'à la fin du trou. *(si un segment finit au début du trou)*
2. **Prolonger le segment de droite** → son `start` recule jusqu'au début du trou. *(si un segment commence à la fin du trou)*
3. **Créer un segment** → choix de la tâche → nouveau segment qui remplit exactement le trou.

Chaque action ferme le popover et **confirme par un toast**.

**Bloc latéral « Temps non tracé » —**
- **Total** : `pause #E8941F` s'il reste des trous, sinon `play #25B35C`.
- **Liste** : par trou → `HH:MM → HH:MM` · durée · bouton **`Combler`** (ouvre le même popover).
- **État zéro** : `✓ Journée entièrement tracée` en `play`.

---

## 8 · Copie & format Jira (RÈGLES)

Partout, **deux formats copiables** (toast de confirmation) :
- **Décimal** — heures à 2 décimales (`1.5`).
- **Jira** — unités `w / d / h / m`, avec **`1d = 450 min = 7,5 h`** et **`1w = 5 d`** (calculées depuis les horaires). Ex. `6h 42m`, `1d 2h`.

Points de copie : par tâche (Déc./Jira), par segment (durée), **récap Jira** d'un groupe (`nom — durée` par ligne).

---

## 9 · Navigation & écrans

- **Onglets de contenu** : Journée · Segments · Tâches · Stats.
- **Écrans plein** : App, **Réglages** (Apparence/Thème, Horaires, Sauvegarde & données), **Guide** (sommaire collant + 6 sections).
- **Header collant** translucide (`blur`), wordmark dot-matrix, pastille « Sauvegardé · il y a N h », icônes Thème / Réglages / Guide / Paramètres.
- **Stats** : page de rétrospective, pilotée par une **fenêtre d'analyse** unique en tête
  d'onglet (chips *4 semaines · 3 mois · 12 mois · Tout*) que tous les blocs suivent.
  - **Cartes** — total (+ écart avec la période précédente, en flèche neutre : jamais de
    vert/rouge sur un volume de travail), moyenne/jour actif, jours actifs, meilleur jour,
    série, couverture des horaires.
  - **Évolution** — aires empilées (ou courbes séparées) du temps par type, granularité
    *Jour · Semaine · Mois*. SVG mesuré en pixels, lissage **monotone** (aucun dépassement
    sous zéro), trame de points en fond, filets de repère `1px dashed var(--dot)`, axes
    10,5 px `--text-faint` en `tabular-nums`. Légende cliquable = masquer une série.
  - **Rythme** — calendrier en **pastilles rondes** (colonnes = semaines, lundi en haut),
    5 paliers `--heat-0..4` dérivés de `--accent` = part de la journée planifiée tracée.
  - **Semaine par semaine** — barre empilée par type, total, jours actifs, écart ; la ligne
    **se déplie** sur le détail « tâche → durée » (même dépliage en `grid-template-rows 0fr→1fr`
    que l'onglet Tâches), et le bouton **Jira** copie ce récap.
  - **Répartition** — barres par type (avec %) et profil lun→dim (le jour de pointe en
    `--accent` plein, les autres en retrait).
  - **Top tâches** — pastille de couleur, nom, badge, barre de part, durée, copies Déc./Jira.
  - **Historique** : pistes journalières sur **axe horaire partagé** (8h–18h), clic sur une
    ligne ouvre le jour ; week-ends grisés (`opacity:.72`).

---

## 10 · Accessibilité & garde-fous

- Anneau de focus visible partout ; cibles tactiles **≥ 30 px** (boutons ronds), **≥ 44 px** pour les actions principales.
- `prefers-reduced-motion` coupe spring/dotIn.
- `tabular-nums` obligatoire sur toute durée.
- Contraste : texte primaire sur surface, `--text-faint` réservé au non-essentiel.
- `color-scheme:dark` sur les contrôles natifs (`time`, `date`, `select`, `checkbox`).
