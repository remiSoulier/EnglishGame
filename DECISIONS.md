# DECISIONS

Choix d'interprétation du cahier des charges pris par l'orchestrateur.

## D1 — `questions.json` absent (2026-11-23)
Le fichier `questions.json` n'était ni à la racine du dépôt ni dans le dépôt distant (vide). Pour ne pas bloquer, `src/data/questions.json` est créé avec **un petit jeu de questions provisoires** respectant exactement le format du cahier des charges (`id`, `category`, `difficulty`, `question`, `choices` A–D, `answer`, `explanation`). Il suffira de remplacer ce fichier par le vrai : aucun code ne dépend de son contenu précis.

## D2 — Premier commit sur un dépôt vide (2026-11-23)
`main` n'avait aucun commit. La tâche #1 est développée sur `feat/1-setup` ; après `VALIDÉ`, `main` est créée à partir de cette branche puis poussée.

## D3 — Fichiers de suivi
`PROGRESS.md` et `DECISIONS.md` sont tenus et commités par l'orchestrateur (`docs(docs): …`).
