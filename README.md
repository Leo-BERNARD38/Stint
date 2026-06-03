# Stint

> Application web personnelle de chronométrage des tâches (dev + support client),
> pensée pour reporter facilement le temps dans Jira.

**Stint** = une période de travail consacrée à une tâche. Le nom sert de wordmark et
reste modifiable dans l'app.

100 % front, **sans build** : HTML + CSS + **modules ES natifs**. Déployable tel quel
sur GitHub Pages, fonctionne hors-ligne une fois chargé.

## Lancer en local

Les modules ES nécessitent d'être servis en HTTP (le protocole `file://` les bloque).
Servez le dossier avec n'importe quel serveur statique :

```bash
python3 -m http.server 8000
# puis ouvrez http://localhost:8000
```

## Déploiement GitHub Pages

Le site est statique : un `push` suffit.

1. Repo → **Settings → Pages**
2. *Source* : `Deploy from a branch`
3. Branche de déploiement, dossier `/ (root)`
4. Servi à `https://<user>.github.io/<repo>/`

Le fichier `.nojekyll` désactive le traitement Jekyll (inutile ici).

## Modèle d'interaction — 3 boutons

| Bouton | Raccourci | Action |
|---|---|---|
| **Play / Pause** | `Espace` | Démarre / met en pause le chrono de la tâche active |
| **Nouvelle tâche** | `N` | Crée une tâche et la démarre immédiatement |
| **Reprise** | `R` | Reprend une tâche **en cours** (ni terminée ni archivée) |

Règle : **une seule tâche active à la fois**.

### Cycle de vie d'une tâche

- **Pause** : arrête le chrono mais la tâche reste **en cours** → elle apparaît dans « Reprise ».
- **Terminer** : ferme la tâche (depuis la carte active ou sa ligne). Elle quitte « Reprise »
  mais reste comptée dans les totaux. **Rouvrir** la remet en cours.

Ainsi « Reprise » ne liste que les tâches réellement en cours.

## Fonctionnalités

- **Segments horodatés** (début → fin) : la durée est toujours dérivée des timestamps,
  jamais d'un compteur. Reconstruction fiable après veille / fermeture d'onglet.
- **Temps ouvré réel** : intersection des segments avec les plages ouvrées (horaires +
  pause déjeuner paramétrables). Un chrono oublié du vendredi au lundi ne compte que les
  heures ouvrées.
- **Mode « temps brut »** activable par segment (nuit, heures sup, sans rognage).
- **Timeline journalière** colorée par tâche + signalement du **temps non tracé**.
- **Totaux** par tâche, par type (dev / support / autre) et pour la journée.
- **Conversions & copie** : décimal (`1.5`) et Jira (`2w 4d 6h 45m`), arrondi
  paramétrable (aucun / 1 / 5 / 15 min).
- **Édition a posteriori** : heures, dates, réaffectation de tâche, saisie manuelle.
- **Persistance locale** (`localStorage`) + **export/import JSON** (format maître) et
  **export CSV** des segments, avec rappel de sauvegarde.
- **Thème** clair / sombre / système, paramétrable (bouton du header ou réglages),
  appliqué sans flash au chargement.

## Design

Interface **flat** : pas de bordures structurelles, des surfaces et de l'espace pour
hiérarchiser. Tous les jetons de couleur vivent dans `assets/styles/variables.css` et
sont thémés via l'attribut `[data-theme]` (`light` / `dark` / `system`).

Icônes : pack [Lucide](https://lucide.dev) (licence ISC), embarqué localement en SVG
inline (`src/ui/icons.js`) — aucune dépendance réseau, se thème via `currentColor`.

## Format de données

Schéma **versionné** (`version: 2`), monté automatiquement depuis les versions
antérieures à l'ouverture (les champs ajoutés — `settings.theme`, `tasks[].done` —
prennent leurs valeurs par défaut). Le JSON exporté est le format maître et reste
compatible avec une future migration vers Vite + React.

## Format Jira

Dans Jira, `1d` ≠ 24 h : c'est `hoursPerDay` (8 par défaut) et `1w` = `daysPerWeek`
jours (5 par défaut). Ces deux valeurs sont paramétrables dans **Réglages**.

## Données & vie privée

Aucun compte, aucun backend, aucune synchronisation. Les données vivent uniquement dans
votre navigateur. ⚠️ Un nettoyage de cache ou la navigation privée peuvent les effacer :
**exportez régulièrement le JSON** comme sauvegarde maître.

## Architecture

Voir [`ARCHITECTURE.md`](ARCHITECTURE.md). En bref : modèle de domaine orienté objet
(`Store` comme source de vérité émettant des évènements), services de calcul/format/I-O
isolés, et une couche UI en vues/modales découplées pilotées par un contrôleur `App`.
Le modèle de données est versionné, compatible avec une migration future vers
Vite + React sans réécriture des données.
