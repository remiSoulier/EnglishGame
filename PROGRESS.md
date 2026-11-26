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
- [x] #11 Home + New game (ui-dev)
- [x] #12 Navigation (ui-dev)
- [x] #13 Popup question (ui-dev)
- [x] #14 Question + Result (ui-dev)
- [x] #15 We have a winner (ui-dev)

## Priorité 3 — utile
- [x] #16 Tests du générateur (tester)
- [x] #17 Questions sans doublon (engine-dev)
- [x] #18 PWA (setup-dev)
- [x] #19 Parcours e2e (tester)

## Priorité 4 — optionnel
- [x] #20 Liste écrite des positions (ui-dev)

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
| 2026-11-23 | #11 | VALIDÉ (no defect). App now opens on Home; the app name lives in src/state/appInfo.ts. Merged into main. |
| 2026-11-23 | #13, #14 | VALIDÉ both (no defect). Developed on one branch (D9). Merged into main. |
| 2026-11-23 | #15 | VALIDÉ (no defect). Also adds the New board confirmation (part of #12). Earlier unit/e2e failures were timeouts under heavy machine load; all green once the load dropped. Merged into main. |
| 2026-11-23 | #12 | VALIDÉ (no defect). Quit to home + Continue game, system back, heading focus (D10). Merged into main. |

## Point de fin de priorité 2 — 2026-11-23

**Validées (7/7) :** #9 Code de plateau, #10 État de la partie, #11 Home + New game, #12 Navigation, #13 Popup question, #14 Question + Result, #15 We have a winner. La tâche #17 (questions sans doublon, priorité 3) a été avancée car #14 en dépendait ; elle est aussi validée.

**Bloquées :** aucune. Aucun refus du validateur. Défauts trouvés par les testeurs et corrigés avant validation : `parseCode` acceptait `ß`/ligatures (#9), le reducer renvoyait `undefined` pour une action inconnue (#10).

**État :** l'application est jouable de bout en bout : Home → New game (joueurs, difficulté, code aléatoire ou saisi) → plateau → questions (sans doublon, un essai) → fin de tour → nouveau plateau → gagnant → rejouer / accueil. Partie sauvegardée et reprise (*Quit to home* / *Continue game*). 1428 tests unitaires et 64 tests e2e passent ; lint, typecheck, build et format OK.

**Risques / dette :**
- Le test « 30 questions sans doublon » dans `App.test.tsx` est lent : il a dépassé 60 s quand la machine était très chargée (charge ~15–18) ; tout passe quand la charge est normale.
- Le nom du jeu reste un placeholder (`APP_NAME = 'Board Game Companion'` dans `src/state/appInfo.ts`).
- Cosmétique (P1) : mur qui dépasse de quelques pixels au bord, « P » minuscule dans l'icône Start de la légende.
- Reste à faire : priorité 3 (#16 tests du générateur, #18 PWA, #19 parcours e2e), priorité 4 (#20), puis README et validation finale de l'ensemble.
| 2026-11-24 | #16 | VALIDÉ (validator ran 9 mutations of the engine: all caught). Mean 0.12 ms per board. Merged into main. |
| 2026-11-24 | #19 | VALIDÉ (journey passes 3/3). Note: Playwright reuses a server already on port 4173, so parallel e2e runs from two checkouts can test the wrong build; validator re-ran with CI=1. Merged into main. |
| 2026-11-24 | #18 | VALIDÉ (no defect). vite-plugin-pwa 2.0.0, full game verified offline in e2e. Merged into main. |
| 2026-11-24 | README | VALIDÉ: install, run, test and deploy (Vercel + Netlify) guide in French, plus netlify.toml and vercel.json. Real deploy not tried. Merged into main. |
| 2026-11-24 | #20 | VALIDÉ (no defect). Collapsible positions list under the grid. Merged into main. |
| 2026-11-24 | Final | VALIDÉ: final validator pass on the whole app against sections 3 and 4 (8 screens played at 390×844, 800 boards checked with an independent script, all gates green). |

## Point final — 2026-11-24

**Projet terminé** selon la définition de « fini » (section 7) :
- Toutes les tâches de priorité 1 et 2 sont `VALIDÉ` ; celles de priorité 3 (#16, #17, #18, #19) et 4 (#20) aussi. Aucune tâche bloquée, aucun refus du validateur sur l'ensemble du projet.
- `npm run lint`, `typecheck`, `test` (1480 tests), `e2e` (73 tests) et `build` passent sur `main`.
- Validation finale de l'application entière contre les sections 3 et 4 : `VALIDÉ`.
- `README.md` : installation, lancement, tests, déploiement Vercel et Netlify (`vercel.json`, `netlify.toml`).

**Points ouverts (non bloquants) :**
- Nom du jeu encore provisoire (« Board Game Companion ») ; il apparaît dans `src/state/appInfo.ts`, `vite.config.ts`, `index.html`, `e2e/helpers.ts` et `e2e/pwa.spec.ts` (voir README).
- Aucun déploiement réel n'a été fait.
- Cosmétique : mur terminé au bord qui dépasse de quelques pixels, « P » minuscule dans l'icône Start de la légende, grand espace vide sous la liste des positions à 844 px.
- Playwright réutilise un serveur déjà lancé sur le port 4173 en local : lancer les e2e avec `CI=1` si une autre preview tourne.
- Le test « 30 questions sans doublon » peut dépasser son délai si la machine est très chargée.

## Changements demandés après livraison
- [x] #21 Retirer le tour par tour : seulement un bouton End turn (ui-dev)

| 2026-11-24 | #21 | VALIDÉ (user change request, D11): no turn order, End turn always available; storage moved to bgc.game.v2. Merged into main. |
- [x] #22 Texte de la popup simplifié : « Answer correctly to draw X cards. One try only. » (ui-dev)

| 2026-11-24 | #22 | VALIDÉ: popup text no longer mentions ending your turn (avoids confusion with End turn, D11). Merged into main. |
- [x] #23 Jeu fixe de 8 murs W1–W8, seules la place et l'orientation sont tirées (engine-dev)
- [x] #24 Nom de chaque mur sur la grille et dans la liste des positions (ui-dev)

| 2026-11-24 | #23, #24 | VALIDÉ both (D12). One defect fixed before validation: wall badges covered an enemy or the goal on ~11% of boards. Merged into main. |
- [x] #25 Rivets aux deux bouts de chaque mur pour distinguer les pièces qui se touchent (ui-dev)

| 2026-11-24 | #25 | VALIDÉ after 1 refusal: badges hid junction rivets on ~12% of boards; fixed (badges now avoid all rivets) and re-validated. Merged into main. |
- [x] #26 Écran gagnant retiré, bouton End game dans le menu (ui-dev)
- [x] #27 Style SILVA de la maquette (ui-dev)
- [x] #28 Nom SILVA dans le manifeste, la page et les icônes (setup-dev)

| 2026-11-25 | #26 | VALIDÉ (no defect, D13). Merged into main. |

| 2026-11-25 | #27, #28 | VALIDÉ both (D14): SILVA style from the user mockup and SILVA name, manifest, icons. Merged into main. |
- [x] #29 Illustrations Figma optimisées en WebP et mises en cache (setup-dev)
- [x] #30 Fond d'accueil, texture du plateau, personnages sur les cases de départ (ui-dev)

| 2026-11-25 | #29, #30 | #29 VALIDÉ. #30 VALIDÉ after 1 refusal (walls hid P1/P3 labels; fixed, regression test proven to fail before the fix; re-checked by the orchestrator after the user asked to stop using subagents). Merged into main. |
- [x] #31 Rôles des personnages : joueurs chat, chauve-souris, champignon, hérisson ; objectif dragon ; ennemis croco et fantôme (orchestrateur)
- [x] #32 Les murs ne se croisent plus (orchestrateur)

| 2026-11-25 | #31, #32 | Done by the orchestrator itself (user asked to stop using subagents): D15 character roles, D16 no crossing walls (0 crossings on 9 000 boards). 1680 unit tests, 101 e2e. Merged into main. |
- [x] #33 Araignée ajoutée comme troisième ennemi (orchestrateur)

| 2026-11-25 | #33 | Done by the orchestrator: spider cut out of its background, third enemy. 1683 unit tests, 101 e2e. Merged into main. |
- [x] #34 Le dragon démarre à au moins 6 pas de chaque joueur, écart ≤ 4 (orchestrateur)

| 2026-11-25 | #34 | Done by the orchestrator: fair goal rule C (D17), 13 central cells. 1687 unit tests, 101 e2e. Merged into main. |
- [x] #35 DA de la maquette Figma : accueil (fond lac, logo), question et résultat en popup sur le plateau avec carte qui se retourne, départs en ronds pointillés

| 2026-11-26 | #35 | Done (D18). 1696 unit tests, 101 e2e, lint, typecheck and build green. Branch feat/silva-da-maquette, not pushed yet (to review with the group). |
- [x] #36 Choix du personnage par joueur sur New game (D19), dragon flottant sur l'accueil

| 2026-11-26 | #36 | Done (D19). 1709 unit tests, 101 e2e, lint and typecheck green. Same branch feat/silva-da-maquette, not pushed. |
- [x] #37 Accueil animé : lune-barque qui tangue, ronds dans l'eau, reflets sur le lac (D20)

| 2026-11-26 | #37 | Done (D20). 1714 unit tests, 101 e2e, lint and typecheck green. Same branch, not pushed. |
- [x] #38 Murs sans étiquettes W1 … W8 sur le plateau (D21)

| 2026-11-26 | #38 | Done (D21). 1715 unit tests, 101 e2e, lint and typecheck green. |
- [x] #39 Plus de code de plateau sur New game, le plateau et l'accueil (D22)

| 2026-11-26 | #39 | Done (D22). 1700 unit tests, 95 e2e, lint and typecheck green. |
- [x] #40 Contours fins de 0,5 px (D23)

| 2026-11-26 | #40 | Done (D23). 1700 unit tests, 95 e2e, lint and typecheck green. |
- [x] #41 Mélange du plateau à la fin du tour (D24)

| 2026-11-26 | #41 | Done (D24). 1703 unit tests, 95 e2e, lint and typecheck green. |
