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
