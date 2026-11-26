# SILVA

**SILVA — _Program your way to the goal_.** Application web mobile qui accompagne un **jeu de
plateau physique** compétitif pour 2 à 4 joueurs. L'interface est en anglais ; pour changer le nom,
voir [Personnaliser le nom du jeu](#personnaliser-le-nom-du-jeu).

## Présentation

Ce que fait l'application :

- génère le plateau 9×9 : 8 murs, des ennemis selon la difficulté (Easy 2, Medium 4, Hard 6) et un
  objectif fixe pour toute la partie ;
- redessine les murs et les ennemis à chaque fin de tour ;
- pose des questions à choix multiples (« Question for 1–3 cards ») et indique combien de cartes
  piocher en cas de bonne réponse ;
- explique les règles en 6 étapes (_How to play_) et les notions de programmation (_Lexicon_) ;
- termine la partie depuis le menu (_End game_) quand un pion atteint le dragon ;
- sauvegarde la partie en cours dans le navigateur (`localStorage`, clé `bgc.game.v2`) et fonctionne
  hors ligne (PWA installable).

Un seul téléphone sert de maître du jeu pour toute la table : chaque partie tire un plateau au
hasard, et il n'y a pas de code de plateau à partager ni de synchronisation entre téléphones.

Ce qu'elle ne fait pas : pas de pions (les joueurs déplacent les leurs sur le plateau physique), pas
de comptes, pas de back-end, pas de synchronisation réseau entre appareils.

Stack : React 19 + TypeScript, Vite 8, CSS Modules, `useReducer` + Context, grille en SVG,
`vite-plugin-pwa`, Vitest, Playwright, ESLint + Prettier, commitlint + husky.

## Prérequis

- Node.js **22** ou plus (`engines` dans `package.json`)
- npm **10** ou plus

## Installation

```sh
git clone git@github.com:remiSoulier/EnglishGame.git
cd EnglishGame
npm ci
npx playwright install chromium   # uniquement pour les tests e2e et `npm run icons`
```

`npm ci` installe aussi le hook git husky (`commit-msg` → commitlint).

## Lancer

| Commande          | Rôle                                                                        |
| ----------------- | --------------------------------------------------------------------------- |
| `npm run dev`     | Serveur de développement Vite (http://localhost:5173), rechargement à chaud |
| `npm run build`   | Vérification TypeScript (`tsc -b`) puis build de production dans `dist/`    |
| `npm run preview` | Sert `dist/` en local (http://localhost:4173), service worker compris       |

Le service worker n'est actif qu'avec le build de production (`build` puis `preview`), pas avec
`npm run dev`. Pour tester sur un téléphone du même réseau : `npm run preview -- --host`.

## Tester

| Commande               | Rôle                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `npm run lint`         | ESLint                                                      |
| `npm run typecheck`    | TypeScript sans émission (app + config Node)                |
| `npm test`             | Tests unitaires et de composants (Vitest + jsdom)           |
| `npm run e2e`          | Tests de bout en bout (Playwright, Chromium, écran 390×844) |
| `npm run format:check` | Vérifie le formatage Prettier (`npm run format` corrige)    |

Les tests unitaires sont à côté du code (`src/**/*.test.ts(x)`). Les tests e2e sont dans `e2e/` ;
`e2e/journey.spec.ts` est le scénario de démo : nouvelle partie à 3 joueurs en Medium (plateau du
code interne `K7F2-9QX`, chargé par la sauvegarde) → bonne réponse et pioche de cartes → mauvaise
réponse → fin de tour (l'objectif reste, les ennemis bougent) → fin de partie.
`e2e/pwa.spec.ts` vérifie le manifeste, le service worker et une partie complète hors ligne.

Playwright build l'application puis lance `vite preview` sur le port **4173**. En local, il
**réutilise un serveur déjà lancé sur ce port** : arrêtez tout autre `npm run preview` (qui pourrait
servir un ancien build ou un autre projet), ou forcez un build neuf avec `CI=1 npm run e2e`.

## Questions

Les questions sont dans `src/data/questions.json`, un tableau d'objets :

```json
{
  "id": 1,
  "category": "History",
  "difficulty": "easy",
  "question": "Who is often called the first computer programmer?",
  "choices": { "A": "Marie Curie", "B": "Ada Lovelace", "C": "Grace Hopper", "D": "Alan Turing" },
  "answer": "B",
  "explanation": "In 1843, Ada Lovelace wrote an algorithm for Charles Babbage's Analytical Engine."
}
```

- `id` : entier, unique ;
- `category` : `History`, `Concepts` ou `Board` ;
- `difficulty` : `easy`, `medium` ou `hard` (n'influe pas sur le nombre de cartes, tiré entre 1 et 3) ;
- `choices` : 2 à 4 réponses aux clés consécutives à partir de `A` (`A`, `B`, puis `C`, `D`) ;
- `answer` : une des clés de `choices` ;
- `question`, `explanation` : textes non vides.

Pour remplacer les questions, remplacez le contenu du fichier en gardant ce format, puis lancez
`npm test` et `npm run build`. Le fichier est validé au chargement (`src/data/questions.ts` →
`parseQuestions` dans `src/engine/questions.ts`) : une donnée invalide lève une erreur qui indique
l'index de la question fautive. Une question n'est pas reposée avant que toutes l'aient été.

## Code de plateau

Depuis la décision D22, le code n'est plus affiché ni saisi : chaque nouvelle partie tire un code au
hasard, gardé dans la sauvegarde comme graine du plateau. Un code compte 7 caractères `XXXX-XXX`
(ex. `K7F2-9QX`), tirés d'un alphabet sans caractères ambigus (ni `0`/`O`, ni `1`/`I`/`L`).

Le plateau est **déterministe** : le code et le numéro de tour donnent une graine (hash FNV-1a) qui
alimente un générateur pseudo-aléatoire `mulberry32`. Même code + même tour + même difficulté =
même plateau, ce qui permet de recharger une partie et de tester un plateau connu.

## PWA / hors ligne

- **Installer** : ouvrir le site déployé (HTTPS) puis « Ajouter à l'écran d'accueil » (Android
  Chrome) ou Partager → « Sur l'écran d'accueil » (iOS Safari).
- **Hors ligne** : après une première visite, tout le site est en cache (service worker Workbox
  généré par `vite-plugin-pwa`, mise à jour automatique au déploiement suivant). Une partie complète
  se joue sans réseau.
- **Icônes** : `public/icons/` (192, 512, 512 maskable, apple-touch-icon 180) et
  `public/favicon.svg`, dans le style SILVA (cadre et grille vert citron sur vert forêt). Elles sont
  générées par `npm run icons` (`scripts/generate-icons.mjs`, nécessite Chromium de Playwright).
  Pour de vraies icônes, remplacez les fichiers en gardant les mêmes noms et tailles.
- **Illustrations** : `public/art/*.webp` (fonds `bg-*`, texture du plateau `board-texture`,
  personnages `char-*`, scène animée de l'accueil `bg-lake` + `scene-boat`, et cartes `card-*` :
  dos `card-question` et `card-instruction`, cartes `card-forward`, `card-turn` et `card-repeat`
  du tutoriel _How to play_), précachées pour le hors ligne. Les originaux PNG exportés de Figma sont
  dans `docs/design/art-src/`. Pour les régénérer : `npm run art` (`scripts/optimize-art.mjs`,
  nécessite `cwebp` et `dwebp` de libwebp, `brew install webp`) — fonds à 780 px de large, texture
  à sa taille, personnages détourés et ramenés à 256 px de côté maximum, dos de cartes à 720 px.
  Le logo de l'accueil est `public/silva-logo.svg`.

## Personnaliser le nom du jeu

Le jeu s'appelle **SILVA** (slogan « Program your way to the goal », décision D14). Pour changer le
nom :

1. `src/state/appInfo.ts` : `APP_NAME` (et le slogan `APP_TAGLINE`) affichés dans l'application ;
2. `vite.config.ts` : `manifest.name`, `manifest.short_name` (≤ 12 caractères conseillé, sous
   l'icône) et `manifest.description` ;
3. `index.html` : la balise `<title>` et la balise `<meta name="description">` ;
4. optionnellement `name` dans `package.json` ;
5. les tests e2e : `APP_NAME` dans `e2e/helpers.ts` et le nom attendu dans `e2e/pwa.spec.ts`.

Relancez ensuite `npm test` et `npm run e2e`.

## Déployer

Le site est statique (`dist/`). Les fichiers [`vercel.json`](vercel.json) et
[`netlify.toml`](netlify.toml) contiennent déjà toute la configuration : aucun réglage n'est à
faire dans le tableau de bord. Ils ajoutent aussi les en-têtes de cache : `no-cache` pour `sw.js`,
`registerSW.js`, `manifest.webmanifest` et `index.html` (pour que les mises à jour arrivent),
cache long pour `/assets/*` (fichiers hachés).

Le service worker exige **HTTPS** (fourni par Vercel et Netlify). Il n'y a qu'une route, donc pas
besoin de règle de réécriture SPA ; hors ligne, le service worker sert de toute façon `index.html`
pour toute navigation (`navigateFallback`).

### Vercel

1. Sur https://vercel.com, **Add New… → Project**, importer le dépôt GitHub.
2. Vérifier les valeurs (lues depuis `vercel.json`) : Framework Preset **Vite**, Build Command
   `npm run build`, Output Directory `dist`, Install Command `npm ci`.
3. Node.js : le champ `engines` de `package.json` (`>=22`) a priorité sur le réglage du tableau
   de bord, et Vercel choisit alors sa version la plus récente compatible (22 ou plus, avec un
   avertissement). Le build fonctionne avec ces versions ; aucun réglage n'est nécessaire.
4. **Deploy**. Chaque push sur `main` redéploie la production ; chaque autre branche obtient une
   preview.

En ligne de commande : `npx vercel` (preview) puis `npx vercel --prod`.

### Netlify

1. Sur https://app.netlify.com, **Add new site → Import an existing project**, choisir le dépôt
   GitHub.
2. Les valeurs sont lues depuis `netlify.toml` : Build command `npm run build`, Publish directory
   `dist`, `NODE_VERSION = "22"`.
3. **Deploy site**. Chaque push sur `main` redéploie ; les pull requests ont un Deploy Preview.

En ligne de commande : `npx netlify-cli deploy --build` (brouillon) puis
`npx netlify-cli deploy --build --prod`.

## Structure du projet

```text
src/
  engine/       logique pure en TypeScript, sans React : types, rng (mulberry32), boardCode,
                walls, connectivity, generator, questions
  components/   composants réutilisables (Button, Grid, Legend, Logo, Menu, Modal, PlayerBar,
                PositionsList)
  screens/      écrans (Home, NewGame, Board, QuestionPopup, Question, Result, NewBoard, Winner)
  state/        gameReducer, GameContext, storage (localStorage), navigation, appInfo
  data/         questions.json + questions.ts (chargement et validation)
  styles/       tokens.css (couleurs, espacements), global.css
e2e/            tests Playwright
public/         favicon, icônes PWA et illustrations (art/)
scripts/        generate-icons.mjs, optimize-art.mjs
```

## Conventions

- Commits au format [Conventional Commits](https://www.conventionalcommits.org/), vérifiés par
  commitlint : types `feat`, `fix`, `test`, `refactor`, `docs`, `style`, `chore`, `build`, `ci`,
  `perf` ; scopes `engine`, `ui`, `state`, `pwa`, `data`, `setup`, `e2e`, `docs` ; lignes du corps
  ≤ 100 caractères ; référence de tâche en pied (`Refs: #<id>`).
- Une branche par tâche : `feat/<id>-<slug>` (ex. `feat/1-setup`), fusionnée dans `main` après
  validation.
- Suivi des tâches : [PROGRESS.md](PROGRESS.md). Décisions techniques : [DECISIONS.md](DECISIONS.md).
