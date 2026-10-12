# Reprendre le projet dans une nouvelle conversation

## Mise en route

1. Décompresse `roguefus-lite.zip`, ouvre un terminal dans le dossier, lance `npm install`.
2. Vérifie : `npx vitest run` (124 tests verts attendus) puis `npm run dev` (http://localhost:5173).
3. Lance `git init && git add -A && git commit -m "Départ"` si tu veux un historique (le zip n'a pas le dossier .git).

## Texte à coller au début de la nouvelle conversation

> Projet « Roguefus Lite » (roguelite web en JavaScript, Vite + vitest + prettier, inspiré de Dofus).
> Réponds en français. Lis d'abord README.md, CHANGELOG.md (historique des changements) et
> PLAN-AMELIORATIONS.md (plan complet d'améliorations en tâches, avec les règles de travail).
> Les messages de commit sont en français. Ne pousse rien sans demande. Ne casse pas les sauvegardes
> (clés localStorage rld_meta_v0, rld_run_v0, rld_settings_v0, rld_sync_v0, rld_backup_v0).
> Commence par : <ta demande, par exemple « Exécute le lot A de PLAN-AMELIORATIONS.md »>.

## Repères

- Données : src/data/*.json. Logique : src/jeu/, src/combat/, src/carte/. UI : src/ui/. Sauvegarde : src/sauvegarde/.
- Simulation d'équilibrage : `npm run sim -- t1,t3,t5 30`.
- Version claude.ai (artefact) : `bash outils/artefact/construire.sh` après commit, puis publication (voir PLAN-AMELIORATIONS.md, section 0).
- Artefact actuel : https://claude.ai/artifact/K3x9YigYz1DC9yT43S6z2m (version 30).
- Sauvegarde en ligne PC ↔ mobile : automatique depuis l'artefact (compte claude.ai), voir Paramètres.
