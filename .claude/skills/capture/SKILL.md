---
name: capture
description: Photographie les écrans de Stint en clair et en sombre (avec données de démonstration) et remonte les erreurs JS. À utiliser pour voir le rendu d'un changement visuel, avant de le montrer à l'utilisateur ou de le committer.
argument-hint: "[écrans…] [--mobile] [--vide]"
---

# Capturer Stint

Écrans : `journee segments saisie taches stats settings guide tools`.

1. `node checks/capture.mjs $ARGUMENTS` — sans argument, tous les écrans.
   PNG dans `captures/` (ignoré par git), nommés `<écran>-<clair|sombre>[-mobile].png`.
   Le script sert le dépôt lui-même, bloque le service worker (sinon on
   photographie l'ancienne version), simule le survol (sinon on photographie la
   variante tactile) et coupe les animations.
2. Lire les PNG concernés (outil Read) et les regarder **vraiment** : alignements,
   débordements, contrastes, ce qui bouge entre clair et sombre.
3. Sortie non nulle = une erreur JS est apparue sur un écran : la corriger avant
   toute chose, une capture d'un écran à moitié planté ne prouve rien.
4. Envoyer à l'utilisateur les captures d'un changement visuel (clair + sombre) :
   c'est lui qui valide le rendu (CLAUDE.md §9).
