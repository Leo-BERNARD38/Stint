# Stint

> Application web personnelle de chronométrage des tâches (dev + support client),
> pensée pour reporter facilement le temps dans Jira.

**Stint** = une période de travail consacrée à une tâche. Le nom sert de wordmark et
reste modifiable dans l'app.

## Démarrer

Ouvrez simplement `index.html` dans un navigateur — aucun build, aucun serveur.
Tout (HTML + CSS + JS) tient dans un seul fichier statique.

### Déploiement GitHub Pages

Le site est statique : un `push` suffit.

1. Repo → **Settings → Pages**
2. *Source* : `Deploy from a branch`
3. Branche : `main` (ou la branche de déploiement), dossier `/ (root)`
4. L'app sera servie à `https://<user>.github.io/<repo>/`

L'application fonctionne **hors-ligne** une fois la page chargée.

## Modèle d'interaction — 3 boutons

| Bouton | Raccourci | Action |
|---|---|---|
| **Play / Stop** | `Espace` | Démarre / arrête le chrono de la tâche active |
| **Nouvelle tâche** | `N` | Crée une tâche et la démarre immédiatement |
| **Reprise** | `R` | Reprend une tâche du jour / en cours |

Règle : **une seule tâche active à la fois**.

## Fonctionnalités

- **Segments horodatés** (début → fin) : la durée est toujours dérivée des timestamps,
  jamais d'un compteur. Reconstruction fiable après fermeture de l'onglet ou veille.
- **Temps ouvré réel** : intersection des segments avec les plages ouvrées
  (horaires + pause déjeuner paramétrables). Un chrono oublié du vendredi soir au lundi
  matin ne compte que les heures ouvrées.
- **Mode « temps brut »** activable par segment (nuit, heures sup, sans rognage).
- **Timeline journalière** colorée par tâche + signalement du **temps non tracé**.
- **Totaux** par tâche, par type (dev / support / autre) et pour la journée.
- **Conversions & copie** : format décimal (`1.5`) et Jira (`2w 4d 6h 45m`),
  arrondi paramétrable (aucun / 1 / 5 / 15 min).
- **Édition a posteriori** : heures, dates, réaffectation de tâche, saisie manuelle.
- **Persistance locale** (`localStorage`) + **export/import JSON** (format maître)
  et **export CSV** des segments, avec rappel de sauvegarde.

## Format Jira

Dans Jira, `1d` ≠ 24 h : c'est `hoursPerDay` (8 par défaut) et `1w` = `daysPerWeek`
jours (5 par défaut). Ces deux valeurs sont paramétrables dans **Réglages** pour
s'aligner sur la configuration de votre projet Jira.

## Données & vie privée

Aucun compte, aucun backend, aucune synchronisation. Les données vivent uniquement
dans votre navigateur. ⚠️ Un nettoyage de cache ou la navigation privée peuvent les
effacer : **exportez régulièrement le JSON** comme sauvegarde maître (l'indicateur
en haut à droite rappelle la dernière export).

## Architecture & évolutions

Fichier unique `index.html`, sans dépendances de build. La logique JS est organisée en
sections claires (état/persistance, calculs, moteur chrono, rendu, I/O). Le modèle de
données (versionné) est compatible avec une migration ultérieure vers Vite + React
sans réécriture des données existantes.
