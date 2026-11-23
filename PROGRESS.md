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
- [x] #8 Fin de tour (ui-dev + engine-dev)

## Priorité 2 — important
- [x] #9 Code de plateau et graine (engine-dev)
- [x] #10 État de la partie (ui-dev)
- [ ] #11 Home + New game (ui-dev)
- [ ] #12 Navigation (ui-dev)
- [ ] #13 Popup question (ui-dev)
- [ ] #14 Question + Result (ui-dev)
- [ ] #15 We have a winner (ui-dev)

## Priorité 3 — utile
- [ ] #16 Tests du générateur (tester)
- [x] #17 Questions sans doublon (engine-dev)
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
| 2026-11-23 | #8 | VALIDÉ (no defect). Merged into main. |

## Point de fin de priorité 1 — 2026-11-23

**Validées (8/8) :** #1 Setup, #2 Modèle, #3 Murs, #4 Connexité, #5 Objectif/ennemis/générateur, #6 Grille SVG, #7 Écran Board, #8 Fin de tour. La tâche #9 (code de plateau, priorité 2) a été avancée car #5 en dépendait ; elle est aussi validée.

**Bloquées :** aucune. Aucune tâche n'a reçu de refus du validateur ; 3 défauts trouvés par les testeurs ont été corrigés avant validation (ordre BFS de `reachableCells`, lettres Unicode comme `ß` acceptées dans les codes, test de connexité trop lent sous charge).

**État :** 561 tests unitaires et 12 tests e2e passent ; lint, typecheck, build et format OK. L'application démarre sur une vraie partie (code aléatoire, Medium, 4 joueurs) et enchaîne les tours.

**Risques / dette :**
- `App.tsx` est piloté par un hook temporaire `useDemoGame` : à remplacer par le reducer + Context + localStorage (#10) et la navigation (#12).
- Les boutons *Question*, *New board* et *We have a winner* ne font encore rien (#12–#15).
- Cosmétique : un mur qui se termine sur le bord dépasse de quelques pixels (bout arrondi) ; grand espace vide sous la légende à 844 px ; « P » minuscule dans l'icône Start de la légende.
- Environ 44 % des tirages bruts de murs isolent une zone et sont refaits : sans effet sur la vitesse (≈0,3 ms par plateau).
- Deux tests e2e vérifient que les ennemis changent d'un tour à l'autre avec un code aléatoire : échec théoriquement possible mais très improbable.
| 2026-11-23 | #17 | VALIDÉ (advanced from priority 3: needed by #14). Question list passed as a parameter (engine purity). Merged into main. |
| 2026-11-23 | #10 | VALIDÉ (one defect fixed: unknown actions returned undefined). Follow-ups for #13/#14: pick only unasked questions; reuse the engine questions module in the reducer. Merged into main. |
