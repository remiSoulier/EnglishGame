# DECISIONS

Choix d'interprétation du cahier des charges pris par l'orchestrateur.

## D1 — `questions.json` absent (2026-11-23)
Le fichier `questions.json` n'était ni à la racine du dépôt ni dans le dépôt distant (vide). Pour ne pas bloquer, `src/data/questions.json` est créé avec **un petit jeu de questions provisoires** respectant exactement le format du cahier des charges (`id`, `category`, `difficulty`, `question`, `choices` A–D, `answer`, `explanation`). Il suffira de remplacer ce fichier par le vrai : aucun code ne dépend de son contenu précis.
**Mise à jour :** l'utilisateur a fourni le vrai fichier (30 questions, 4 choix chacune). Il remplace le provisoire dans `src/data/questions.json`.

## D2 — Premier commit sur un dépôt vide (2026-11-23)
`main` n'avait aucun commit. La tâche #1 est développée sur `feat/1-setup` ; après `VALIDÉ`, `main` est créée à partir de cette branche puis poussée.

## D3 — Fichiers de suivi
`PROGRESS.md` et `DECISIONS.md` sont tenus et commités par l'orchestrateur (`docs(docs): …`).

## D4 — Modèle de données du moteur (2026-11-23)
- Coordonnées internes : `Cell = { x, y }`, `x` 0–8 ↔ colonnes A–I, `y` 0–8 ↔ lignes 1–9 (ligne 1 en haut). Nom lisible `C3` via `cellName` / `parseCell`.
- Directions : l'interface est en anglais, donc on écrit **`N | E | S | W`** (W = West) au lieu de `O`. Le parseur accepte aussi `O` comme alias de `W`.
- Côté normalisé : chaque côté est stocké sous sa forme canonique `E` ou `S` (`D3-W` → `C3-E`, `C4-N` → `C3-S`), clé texte `C3-E`.
- Le générateur pseudo-aléatoire `mulberry32` est livré dès la tâche #2 (le moteur des murs #3 en a besoin) ; la tâche #9 ajoute le code de plateau (`newCode`, `parseCode`) et la dérivation de graine.

## D5 — Cases de départ (2026-11-23)
Les 4 coins A1, I1, A9, I9 sont toujours exclus pour l'objectif et les ennemis, quel que soit le nombre de joueurs (plus simple, et le plateau reste valable si on change de nombre de joueurs). Attribution : P1 = A1, P2 = I9, P3 = I1, P4 = A9 (à 2 joueurs, coins opposés).

## D6 — Code de plateau (2026-11-23, tâche #9)
- 7 caractères affichés `XXXX-XXX` (ex. `K7F2-9QX`), alphabet sans caractères ambigus : `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (pas de 0, O, 1, I, L).
- Saisie tolérante : minuscules, espaces et tirets acceptés ; tout autre caractère (y compris `ß`, ligatures, accents) est refusé, jamais converti.
- Graine : `turnSeed(code, tour)` = FNV-1a + murmur3 fmix32 sur `CODE#tour`, puis `mulberry32`. Même code + même tour = même plateau partout.

## D7 — Objectif et ordre du tirage (2026-11-23, tâche #5)
- Ordre fixe du tirage d'un tour : murs (redessinés tant qu'une case est isolée), puis objectif, puis ennemis.
- Tour 1 : l'objectif est tiré ; le passer en paramètre ne change pas le plateau.
- Tours suivants : l'objectif passé est conservé ; s'il est omis, le moteur recalcule celui du tour 1. Un appareil qui rejoint la partie n'a besoin que du code et du numéro de tour.

## D8 — État de la partie et écrans (2026-11-23, tâches #10–#15)
- L'état de la partie (reducer + Context) porte aussi l'écran courant (`screen`) : la navigation (#12) est pilotée par le reducer, sans routeur.
- Menu *New board* : nouvelle partie avec un **nouveau code aléatoire**, mêmes joueurs et même difficulté, retour au tour 1, après confirmation. (L'écran « New board » de fin de tour reste l'écran 7.)
- Le nombre de cartes X d'une question (1 à 3) est tiré avec `Math.random` : il ne fait pas partie du plateau partagé, donc pas besoin de graine.
- Une question est tirée parmi celles non encore posées dans la partie ; quand toutes l'ont été, on recommence (#17).
- *Continue* après une question passe au joueur suivant (ou, après le dernier joueur, mène à *End turn*).

## D9 — Tâches #13 et #14 sur une seule branche (2026-11-23)
La popup (#13) et les écrans Question/Result (#14) forment un seul parcours et touchent les mêmes fichiers (`App.tsx`, reducer). Ils sont développés sur une seule branche `feat/13-14-question-flow`, chaque commit portant la référence de sa tâche ; testeur et validateur vérifient les deux tâches séparément.

## D10 — Navigation (2026-11-23, tâche #12)
- « Retour possible là où c'est utile » est interprété ainsi : menu *Quit to home* (avec confirmation) qui **garde** la partie sauvegardée ; l'accueil propose alors *Continue game* (tour et code), qui ramène à l'écran où l'on était.
- Lancer une nouvelle partie remplace la partie sauvegardée (l'écran New game le signale).
- Le bouton retour du téléphone ou du navigateur déclenche le retour de l'application uniquement là où il existe (New game, popup de question, choix du gagnant, boîtes de confirmation) ; ailleurs il garde son comportement normal.
- À chaque changement d'écran, le focus clavier va sur le titre de l'écran.
- La carte de navigation est documentée dans `src/state/navigation.ts`.

## D11 — Plus de tour par tour dans l'application (2026-11-24, demande utilisateur)
Sur demande de l'utilisateur, l'application ne suit plus l'ordre des joueurs : plus de joueur actif, plus de bouton *Next player*, plus de barre des joueurs. L'écran Board affiche toujours *Question* et **End turn** ; *End turn* tire le plateau suivant à tout moment. La popup devient « Question for X cards » (sans « Player N »), et *Continue* ramène simplement au plateau. Le nombre de joueurs reste choisi au début : il sert aux cases de départ affichées et au choix du gagnant. Les anciennes sauvegardes (format v1 avec joueur actif) sont ignorées. Remplace en partie D8 (« Continue → joueur suivant »).

## D12 — Jeu fixe de 8 murs (2026-11-24, demande utilisateur)
Les murs sont désormais 8 pièces physiques fixes, toujours les mêmes (cases de 44 mm) :

| Mur | Forme | Côtés |
| --- | --- | --- |
| W1, W2 | droit | 2 |
| W3 | droit | 3 |
| W4 | droit | 4 |
| W5 | L 1 + 1 | 2 |
| W6 | L 2 + 1 | 3 |
| W7 | L 2 + 2 | 4 |
| W8 | L 3 + 2 | 5 |

À chaque tirage, l'application choisit seulement la **place** et le **sens** de chaque pièce : horizontal ou vertical pour les murs droits, l'une des **4 rotations** pour les murs en L (pas de pièce retournée en miroir). Les autres règles restent : entre les cases, jamais le long du bord, pas de chevauchement (contact autorisé), aucune case isolée (sinon on retire). Chaque mur porte son nom (W1…W8) pour que les joueurs sachent quelle pièce poser où. Le message de l'utilisateur était tronqué après « 4 r… » : interprété comme « 4 rotations pour les L ».

## D13 — Plus d'écran « We have a winner », un bouton End game (2026-11-25, demande utilisateur)
Sur demande de l'utilisateur, l'écran 8 (choix du gagnant, « Player X wins! », *Play again*) est supprimé. Dans le menu du plateau, *We have a winner* est remplacé par **End game** : une confirmation (« End this game? » / *End game* / *Cancel*) puis retour à l'accueil, la partie sauvegardée est effacée (pas de *Continue game*). Les joueurs annoncent eux-mêmes le gagnant autour de la table. Le nombre de joueurs ne sert plus qu'aux cases de départ affichées. Les sauvegardes encore sur l'écran gagnant sont ramenées au plateau. Remplace la partie « Victoire » du cahier des charges et la tâche #15.

## D14 — Style « SILVA » de la maquette (2026-11-25, demande utilisateur)
L'utilisateur a fourni une maquette (fichier `docs/design/silva-mockup.webp`). Choix de l'utilisateur : reprendre **le style seulement** et le nom **SILVA** (« Program your way to the goal »), en gardant les décisions récentes : pas de tour par tour (D11), murs fixes W1–W8 (D12), *End game* au lieu de l'écran gagnant (D13). Les éléments de la maquette qui les contredisent (barre P1…P4 « now », « We have a winner », texte « a wrong answer ends your turn ») ne sont pas repris. Les tuiles de végétation illustrées sont approchées par des couleurs et motifs simples (pas d'images sources).

## D15 — Rôles des personnages (2026-11-25, demande utilisateur)
- Protagonistes (joueurs P1–P4) : le chat (`kitkat`), la chauve-souris (`batman`), le champignon (`toad`), le hérisson (`gus`).
- Objectif : le dragon blanc ailé (`dragon`).
- Ennemis : le crocodile (`croco`), le fantôme (`croque-mort`, choix de l'utilisateur) et l'araignée (`spider`), utilisés à tour de rôle. L'araignée a été fournie sur un fond de nuit : elle a été détourée par l'orchestrateur (original dans `docs/design/spider-original.png`, détourage dans `docs/design/art-src/char-spider.png`).
- Sur le plateau, l'objectif et chaque ennemi montrent leur personnage sur une plaque colorée (or / corail) ; l'étoile et le losange « ! » restent en petit badge dans le coin de la case, pour garder un repère de forme. Les étiquettes des murs évitent désormais toute la case d'un ennemi ou de l'objectif.
- Le mapping est dans `src/state/players.ts`.

## D16 — Les murs ne se croisent pas (2026-11-25, demande utilisateur)
« Les murs ne doivent pas se chevaucher » : en plus de ne jamais partager un côté de case, deux pièces ne peuvent pas se **croiser** (un même coin de grille à l'intérieur de deux pièces, ce qui les poserait l'une sur l'autre). Elles peuvent toujours se toucher bout à bout ou en T (le bout d'une pièce contre le flanc d'une autre).

## D17 — Le dragon n'est pas trop près d'un joueur (2026-11-25, demande utilisateur)
Règle choisie par l'utilisateur (option C) : au premier tour, l'objectif (le dragon) est tiré parmi les cases à **au moins 6 pas** de chaque case de départ, et telles qu'**aucun joueur n'a plus de 4 pas d'avance** sur un autre. Les pas sont comptés sur la grille sans les murs (les murs bougent à chaque tour, l'objectif ne bouge pas). Les 4 coins comptent toujours, quel que soit le nombre de joueurs, pour qu'un même code donne le même plateau à 2, 3 ou 4 joueurs. Cela laisse 13 cases centrales : E3, D4, E4, F4, C5, D5, E5, F5, G5, D6, E6, F6, E7. Les parties déjà commencées gardent leur objectif sauvegardé ; un code déjà utilisé donne désormais un autre objectif.

## D18 — DA de la maquette Figma : accueil, question en popup, carte qui se retourne (2026-11-26, demande utilisateur)
Maquette : https://www.figma.com/design/HNw6XYnhOeh7hKIpMSd4j1 (frames « 1 · Home », « 4 · Popup », « 3 · Board »). L'utilisateur a demandé de coller davantage à la DA sans casser l'existant.
- **Accueil** : fond lac + lune-barque (`bg-batman`), logo SILVA fourni (`public/silva-logo.svg`, original dans `docs/design/silva-logo-original.svg`) dans le `<h1>` (le texte « SILVA » reste pour les lecteurs d'écran), slogan en capitales blanches, boutons « How to play / Lexicon » au contour plein (plus en pointillés).
- **Question** : la question et le résultat s'affichent par-dessus le plateau (resté `inert` derrière), dans une carte blanche à bord bleu marine. La carte s'ouvre sur le dos de la carte question (« question ? algorithms », `card-question`) qui se retourne ; sans animation avec `prefers-reduced-motion`, et le dos ne bloque jamais les clics. Le résultat montre la carte instruction (`card-instruction`) à côté de « Draw X cards ».
- **Plateau** : les cases de départ ont un rond en pointillés (au lieu d'un carré en tirets) ; les personnages et étiquettes P1–P4 restent (D15).
- Pas repris, car contraires aux décisions D11–D13 : la barre P1…P4 « now », « We have a winner », l'écran « Walls and enemies have moved ».

## D19 — Chaque joueur choisit son personnage ; le dragon sur l'accueil (2026-11-26, demande utilisateur)
- Écran New game : une section « Characters » avec une ligne par joueur (P1 … P4) et les 4 personnages joueurs (Kitkat, Batman, Mushi, Gus). Deux joueurs ne peuvent pas avoir le même : choisir un personnage déjà pris échange les deux. Le choix est enregistré dans la partie (`game.characters`, index dans `PLAYER_CHARACTERS`), conservé par « New board », et affiché sur les cases de départ et dans la légende. Les parties sauvegardées avant D19 se chargent toujours (joueur i = personnage i).
- Les personnages portent les noms des illustrations : Kitkat, Batman, Mushi, Gus (joueurs), Dragon (objectif), Croco, Kevin, Vecna (ennemis).
- Accueil : le dragon flotte au-dessus du lac, décoratif (sans animation avec `prefers-reduced-motion`).
- Pas de personnage sur la carte de résultat : l'appli ne sait pas qui répond (D11), l'utilisateur a choisi de ne pas l'ajouter.

## D20 — Accueil animé : la lune-barque tangue, reflets sur le lac (2026-11-26, demande utilisateur)
- La barque a été découpée de l'illustration du lac (`docs/design/art-src/scene-boat.png`) et le lac sans barque a été reconstitué (`docs/design/art-src/bg-lake.png`, l'original `bg-batman.png` est gardé). Sur l'accueil, la barque est un calque qui tangue doucement (rotation ±2°, léger mouvement vertical), deux ronds dans l'eau partent de sa base, et des reflets clairs scintillent rapidement sur le lac.
- La scène reproduit le cadrage d'avant (`cover`, ancrée à 72 % en largeur) grâce aux container queries ; tout est décoratif (`aria-hidden`), ne prend aucun clic, et reste immobile avec `prefers-reduced-motion` (reflets et ronds masqués).

## D21 — Les murs sans leur nom sur le plateau (2026-11-26, demande utilisateur)
« Ne mets pas leurs noms, juste leurs designs » : le plateau n'affiche plus les étiquettes W1 … W8 sur les murs, seulement les traits et leurs extrémités. Le code des étiquettes est gardé en option (`<Grid wallLabels />`, avec ses tests). La liste des positions garde le nom et la taille de chaque pièce physique (ex. « W6 (88 + 44 mm) »), utile pour monter le vrai plateau, et les `<title>` des murs restent pour les lecteurs d'écran.

## D22 — Plus de code de plateau à l'écran (2026-11-26, demande utilisateur)
« Enlever le truc pour rejoindre avec le code et le code, parce que ça sert à rien » :
- New game n'a plus de section « Board » (*Random board* / *Enter a board code*) ni de champ de saisie : chaque partie tire un plateau au hasard.
- Le plateau n'affiche plus « Code XXXX-XXX · Medium », seulement la difficulté (« Medium ») sous « Turn N ». *Continue game* sur l'accueil affiche « Turn N · Medium ».
- Le code reste en interne, comme graine du plateau, dans la sauvegarde (`game.code`) : *End turn* et *New board* marchent comme avant, et les sauvegardes existantes se chargent toujours. Les tests qui ont besoin d'un plateau connu le chargent par la sauvegarde (e2e) ou fixent le prochain code tiré (tests unitaires).
- On ne peut donc plus afficher le même plateau sur deux téléphones avec un code ; remplace la partie « code partagé » du cahier des charges.

## D23 — Contours fins (2026-11-26, demande utilisateur)
« Les contours fins en 0.5 » : les contours des boutons, des options de New game (joueurs, personnages, difficulté), du menu, de la liste des positions et des réponses passent de 2 px à **0,5 px** (jeton `--border-thin`). Sur le plateau, les traits des cases passent à 0,5 et le bord du plateau à 1 (il reste le repère du bord). Les réponses juste / fausse du résultat gardent un contour un peu plus marqué (1,5 px), et la carte de question / résultat garde son cadre bleu marine de 2 px de la maquette (D18). Les anneaux de focus clavier ne changent pas. L'option choisie reste reconnaissable à son fond vert citron et à son contour plus foncé.

## D24 — Mélange du plateau à la fin du tour (2026-11-26, demande utilisateur)
« Une animation de shuffle au moment où on end the turn, pour montrer que l'écran a changé » : l'écran « Walls and enemies have moved » s'ouvre sur un mélange rapide. Le plateau est battu à gauche et à droite comme un paquet de cartes (0,6 s), puis les murs et les ennemis sont distribués un par un (60 ms d'écart). C'est décoratif : le plateau et la liste des positions sont complets dès la première image pour les lecteurs d'écran et les clics, et rien ne bouge avec `prefers-reduced-motion`.

## D25 — Écran Lexicon (2026-11-26, demande utilisateur)
- **Accès** : le bouton « Lexicon » de l'accueil n'est plus grisé (« How to play » reste « coming soon ») ; le menu ≡ du plateau propose « Lexicon » entre « New board » et « End game », sans confirmation.
- **Navigation** : le Lexicon est un état d'UI local de `App.tsx` (comme les dialogues du plateau), pas un écran du reducer. Il s'affiche en plein écran blanc par-dessus l'accueil ou le plateau, laissés `inert` derrière. Rien n'est dispatché ni sauvegardé : fermer le Lexicon rend exactement le même écran (même plateau, même tour), et le focus revient sur le bouton qui l'a ouvert. Retour (‹ ou bouton système) : « See all » → entrée du Lexicon → écran d'origine. Documenté dans `NAVIGATION` / `LEXICON_EXITS` (`src/state/navigation.ts`).
- **Écran** : en-tête ‹ (44 × 44) + « Lexicon » + dragon décoratif ; blocs Concepts / Learned / Level ; « Basic concepts » + « See all » ; 5 cartes de couleur qui se chevauchent (−18 px, coins 24 px, ombre vers le haut), une seule ouverte à la fois (Loop par défaut), penchée de −1,5° (pas avec `prefers-reduced-motion`). Style et tokens des écrans de l'appli, pas de nouvelle police.
- **Appris** : enregistré à part de la partie, clé `silva.lexicon.v1` (`{ version: 1, learned: [ids] }`, `src/state/lexiconProgress.ts`), validée séparément ; une valeur illisible est ignorée et la sauvegarde de la partie (`bgc.game.v2`) n'est jamais touchée.
- **Contenu** (demande : « des textes simples sur les loops, le repeat du jeu, les algorithmes de base, d'autres concepts, puis une partie pour aller plus loin avec if / else, fonction ») : 10 concepts dans `src/data/lexicon.ts`. « Basic concepts » : Algorithm, Instruction, Sequence, Loop (la carte Repeat), Bug. « Going further » : Condition, If / Else, Function, Variable, Nested loop. Les mini programmes utilisent les cartes du jeu (Move forward N, Turn left / right, Repeat, IF there is a wall). Le compteur passe donc à 10 (Learned X / 10), et une seule carte est ouverte à la fois sur les deux sections. « See all » liste les 10 concepts par section avec leur rond « appris ». Seule la couleur jaune (#FFD46E) vient de la charte fournie ; menthe, lavande, citron et bleu reprennent la palette SILVA existante.

## D26 — Désélection des personnages, positions sans mm ni côtés (2026-11-26, demande utilisateur)
- **New game** : retaper le personnage choisi le désélectionne. Tant qu'un joueur n'a pas de personnage, « Start game » est grisé avec « Choose a character for each player. ». Choisir un personnage déjà pris le donne au joueur, l'autre se retrouve sans.
- **Positions** : la liste n'affiche plus les tailles en mm ni les côtés E / S (« les nord, sud, est, ouest, c'est perturbant ») : un mur se lit « W6: C2, C3 ». La légende « E = east side… » est retirée. Le plateau montre le tracé exact du mur. L'info-bulle d'un mur sur le plateau (`<title>`, lue aussi par les lecteurs d'écran) suit le même format : « Wall W6: C2, C3 ».
- **Ennemis et objectif** : plus de badge en coin, sur le plateau comme dans la légende (remplace le losange « ! » et l'étoile de D15). Chaque ennemi est son personnage sur une plaque au contour corail, l'objectif le dragon sur une plaque au contour jaune : le contour et le personnage suffisent à les distinguer.
- **Départs** : le contour en pointillés lavande des cases de départ est un carré (coins arrondis de 2), plus un rond.

## D27 — Un seul téléphone, plus de code de plateau (2026-11-26, demande utilisateur)
Confirme D22 : un seul téléphone mène la partie pour toute la table, il n'y a ni code de plateau à saisir ou partager ni synchronisation entre appareils. Le code a déjà été retiré de l'interface en D22 ; il reste seulement en interne comme graine du plateau (`game.code` dans `bgc.game.v2`), pour que les sauvegardes existantes se chargent et que les tests restent déterministes (`nextCode` simulé en unitaire, plateau chargé par la sauvegarde en e2e). Le README (« Présentation ») est mis à jour : un téléphone, pas de code partagé, *End game*, clé `bgc.game.v2`.

## D28 — How to play : tutoriel des règles en 6 étapes (2026-11-26, demande utilisateur)
- **Accès et navigation** : le bouton « How to play » de l'accueil n'est plus grisé et ouvre l'étape 1. Comme le Lexicon (D25), c'est un état d'UI local de `App.tsx`, affiché par-dessus l'accueil laissé `inert`, sans rien dispatcher ni sauvegarder. ‹, « Skip » et le retour système ramènent à l'accueil (focus rendu au bouton « How to play ») ; « Start a game » (étape 6) ouvre New game. Rouvrir repart de l'étape 1. Documenté dans `NAVIGATION` / `HOW_TO_PLAY_EXITS` (`src/state/navigation.ts`). Il n'est pas proposé dans le menu du plateau.
- **Écran** : scène de 330 px (`bg-lake` en cover à 30 % 52 %, voiles), barre ‹ (44 px) + « How to play » + « Skip », personnage flottant avec halo (immobile avec `prefers-reduced-motion`) ; feuille blanche (marge −28 px, coins 28) avec le badge « Step N of 6 » à la couleur de l'étape, le titre, le texte (16 px, interligne 1,5), une illustration, 6 points (l'actif en pilule marine) et Back (grisé à l'étape 1) / Next (vert citron de la charte `#DDF98D`, bordure fine `--border-thin`, 0,5 px), qui devient « Start a game » à l'étape 6.
- **Couleurs** : charte fournie, en jetons `--color-chart-*` : jaune `#FFD46E`, citron `#DDF98D`, menthe `#AAF2E0`, lilas `#DBBFFF`, marine `#00006D` (étape 6, texte blanc). Contrastes mesurés ≥ 4,5 (e2e).
- **Contenu** : les 6 textes validés sur la maquette, dans `src/data/howToPlay.ts` (typé, testé). Illustrations dessinées en CSS, décoratives (`aria-hidden`), sauf les trois cartes de l'étape 2 (`card-forward`, `card-turn`, `card-repeat`, nouvelles images) qui ont un texte alternatif. Étape 3 : la pastille « Question for 2 cards » est en vert citron de la charte (plus en marine). Étape 6 : juste le dragon au centre, sans encadré ni texte (demande utilisateur). À l'étape 1 les départs sont des carrés en pointillés lavande, comme sur le plateau (D26), plutôt que des ronds.
- **Accessibilité** : à chaque changement d'étape le focus va sur le titre de l'étape (annoncé) ; ← / → changent d'étape seulement quand le focus est dans l'écran ; tout est en vrais boutons.

## D29 — Lexicon : les cartes passent devant au défilement (2026-11-27, demande utilisateur)
- **Demande** : « au fur et à mesure qu'on scrolle sur l'écran les cartes défilent, les cartes passent une à une au premier plan et passent en vue détaillée ». Remplace l'ouverture au toucher de D25 (une carte ouverte, Loop par défaut).
- **Principe** : sous les blocs Concepts / Learned / Level, une piste haute (hauteur de l'écran + 200 px par carte) dont la scène reste collée en haut (`position: sticky`). Chaque tranche de 200 px de défilement (`DECK_STEP`, `src/screens/Lexicon/deckLayout.ts`) amène la carte suivante au premier plan, où elle se déplie en vue détaillée (explication, programme, résultat, personnage) et penche de −1,5°. Les 10 cartes forment un seul paquet (Basic concepts puis Going further) ; le titre de section affiché suit la carte de devant (l'autre reste lisible par les lecteurs d'écran).
- **Paquet** : les cartes déjà vues passent derrière, plus petites, et dépassent de 10 px chacune au-dessus (3 au plus, les autres disparaissent) ; les suivantes s'empilent dessous, repliées, avec le chevauchement de 18 px de D25. Points d'accroche doux (`scroll-snap-type: y proximity`) sur chaque carte et sur l'en-tête. La première carte (Algorithm) est devant à l'ouverture.
- **Toucher et clavier** : toucher le titre d'une carte la fait défiler jusqu'à sa place (sans faire défiler les cartes intermédiaires) ; le focus clavier sur une carte l'amène devant. Cocher « appris » ne déplace plus les cartes (avant, cocher la carte ouverte la fermait).
- **Mouvement** : déplacements et dépliage en 0,35 s ; avec `prefers-reduced-motion`, ni animation, ni défilement doux, ni inclinaison. « See all » ne change pas.
