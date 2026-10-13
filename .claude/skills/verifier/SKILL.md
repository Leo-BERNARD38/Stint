---
name: verifier
description: Lance tous les contrôles de Stint (syntaxe, contrôles statiques, domaine en UTC et Europe/Paris, inventaire, version du service worker) et, si l'interface a changé, l'audit de contraste. À utiliser avant tout commit, ou quand l'utilisateur demande si « tout passe ».
---

# Vérifier Stint

1. `node checks/tout.mjs --fix` — répare seul ce qui se répare (INVENTAIRE.md
   régénéré, `CACHE` bumpé si un fichier servi a changé depuis `origin/master`),
   puis contrôle tout. Sortie non nulle = au moins un échec.
2. Si un fichier de `assets/styles/`, `index.html` ou une vue/composant de
   `src/ui/` a changé : `node checks/contraste.mjs` (attendu : **zéro défaut**,
   deux thèmes, tous les écrans). Ajouter `--mobile` si la mise en page
   téléphone est concernée.
3. Pour chaque échec : lire la ligne, corriger **la cause** (jamais affaiblir le
   contrôle ni la règle du §7 pour le faire passer), relancer.
4. Un nouveau comportement de domaine sans test dans `checks/domaine.mjs` n'est
   pas vérifié : ajouter le test (CLAUDE.md §9).

Rendre compte en une ligne par contrôle, et dire franchement ce qui échoue encore.
