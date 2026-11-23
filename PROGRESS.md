# PROGRESS

Suivi du backlog tenu par l'orchestrateur. Une tâche n'est cochée qu'après le verdict `VALIDÉ` du validator, fusion dans `main` et `git push`.

Légende : `[ ]` à faire · `[~]` en cours · `[x]` validée · `[!]` bloquée (3 refus)

## Priorité 1 — indispensable pour la démo
- [x] #1 Setup (setup-dev)
- [x] #2 Modèle de données (engine-dev)
- [x] #3 Murs (engine-dev)
- [x] #4 Aucune case isolée (engine-dev)
- [x] #5 Objectif, départs, ennemis (engine-dev)
- [x] #6 Grille SVG (ui-dev)
- [x] #7 Écran Board (ui-dev)
- [ ] #8 Fin de tour (ui-dev + engine-dev)

## Priorité 2 — important
- [x] #9 Code de plateau et graine (engine-dev)
- [ ] #10 État de la partie (ui-dev)
- [ ] #11 Home + New game (ui-dev)
- [ ] #12 Navigation (ui-dev)
- [ ] #13 Popup question (ui-dev)
- [ ] #14 Question + Result (ui-dev)
- [ ] #15 We have a winner (ui-dev)

## Priorité 3 — utile
- [ ] #16 Tests du générateur (tester)
- [ ] #17 Questions sans doublon (engine-dev)
- [ ] #18 PWA (setup-dev)
- [ ] #19 Parcours e2e (tester)

## Priorité 4 — optionnel
- [ ] #20 Liste écrite des positions (ui-dev)

## Journal

| Date | Tâche | Événement |
| --- | --- | --- |
| 2026-11-23 | — | Dépôt cloné (vide). Backlog créé. |
| 2026-11-23 | #1 | VALIDÉ par le validator (tester PASS). `main` créée depuis `feat/1-setup` et poussée. Vraies questions (30) intégrées. |
| 2026-11-23 | #2 | VALIDÉ (tester PASS after the lint fix for .claude/). Merged into main. |
| 2026-11-23 | #3 | VALIDÉ (validator asked for a rebase onto main; done, 323 tests pass). Merged into main. |
| 2026-11-23 | #6 | VALIDÉ (optional: the P in the Start legend icon is small). Merged into main. |
| 2026-11-23 | #7 | VALIDÉ (cosmetic: large gap between legend and actions at 844 px). Merged into main. |
| 2026-11-23 | #4 | VALIDÉ (one doc/ordering defect fixed before validation). ~44% of raw wall draws are disconnected and get redrawn. Merged into main. |
| 2026-11-23 | #9 | VALIDÉ (one defect fixed: unicode letters like ß were mapped into valid codes). Merged into main. |
| 2026-11-23 | #5 | VALIDÉ (no defect). Merged into main. |
