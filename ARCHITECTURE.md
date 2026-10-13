# Architecture

Front pur, **modules ES natifs**, aucun build. L'organisation suit une séparation
nette **domaine → services → UI**, pour rester lisible et faciliter les évolutions
(y compris une migration ultérieure vers Vite + React).

## Arborescence

```
index.html, manifest.webmanifest, sw.js, .nojekyll   coquille + PWA
assets/styles/   fonts · variables · base · layout · components
assets/fonts/    woff2 auto-hébergés
src/
  main.js        point d'entrée
  core/          constantes, EventEmitter
  utils/         fonctions pures (dates, intervalles, DOM, recherche…)
  models/        DOMAINE : Settings, Task, Segment, Memo, Store…
  services/      logique transverse : calculs, stats, saisie, persistance…
  ui/            PRÉSENTATION : App (contrôleur), boucles, icônes
    components/  composants partagés (factories) — à réutiliser
    views/       une vue = une région du DOM
    modals/      modales (base `Modal`)
checks/          contrôles Node : domaine, statique, inventaire
```

**Le détail fichier par fichier est dans [`INVENTAIRE.md`](INVENTAIRE.md)**, généré
depuis le code (`node checks/inventaire.mjs`) : une liste tenue à la main ici
dérivait à chaque ajout de fichier.

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
- **`StatsAggregator`** produit un instantané rétrospectif (séries par type, récap
  hebdomadaire, rythme journalier, top tâches, indicateurs) **mémoïsé sur `store.rev`** :
  les six blocs de l'onglet Stats lisent le même objet au lieu de rebalayer l'historique
  chacun de leur côté.
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
