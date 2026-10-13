---
name: livrer
description: Livre un changement de Stint en production — contrôles, commit en français, push sur master (GitHub Pages). À utiliser quand l'utilisateur demande de committer, pousser, déployer ou « livrer ».
---

# Livrer Stint

Un push sur `master` **est** un déploiement (GitHub Pages). Le hook
`avant-push` le bloque si les contrôles échouent ; autant ne pas l'y amener.

1. **Contrôler** : `node checks/tout.mjs --fix`. Tout doit passer. Si
   l'interface a changé : `node checks/contraste.mjs` (zéro défaut) et
   `node checks/capture.mjs <écrans touchés>`, captures à montrer à l'utilisateur.
2. **Relire le diff** (`git diff`, `git status`) : rien d'étranger à la demande,
   pas de fichier de `captures/`, `CACHE` bumpé **une seule fois** par rapport à
   la version en ligne (le script le garantit), tout nouveau fichier servi dans
   `CORE`, CLAUDE.md mis à jour si une règle ou un piège a été appris.
3. **Committer** en français, dans le style des commits existants
   (`git log -5`) : un sujet « Zone : ce qui change », un corps qui dit
   **pourquoi**, ce qui a été écarté et pourquoi, et la valeur de `CACHE`.
4. **Pousser** : `git push origin HEAD:master` (et la branche de travail si la
   session en a une désignée). Jamais de push forcé sur master.
5. Dire à l'utilisateur ce qui est en ligne, la version de `CACHE`, et ce qui
   reste à valider de son côté (rendu, comportement). La PWA installée se met
   à jour seule au prochain focus — sauf son icône (CLAUDE.md §2).
