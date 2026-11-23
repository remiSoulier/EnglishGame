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
