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
