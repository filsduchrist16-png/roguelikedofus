# Roguefus Lite

Roguelite au tour par tour inspiré de DOFUS : on compose une équipe de 2 à 4 héros, on traverse
les zones d'un monde sur une carte à embranchements (combats, tavernes, zaaps, HDV, forgemagie…)
jusqu'au donjon, et on collectionne Dofus, archimonstres, reliques et succès d'une run à l'autre.

Fangame non officiel. Les illustrations DOFUS appartiennent à Ankama.

Les mondes 3 à 5 (donjons des niveaux 101 à 200) reprennent les monstres, boss, objets et
reliques de DOFUS d'après DofusDB, répartis selon les catégories de succès « Donjons » de Dofus 3.

## Lancer le jeu

```bash
npm install
npm run dev      # serveur de développement (http://localhost:5173)
npm run build    # version de production dans dist/
npm run preview  # sert dist/ en local
npm test         # tests : cohérence des données + 600 combats simulés au hasard
```

`FUZZ_N=5000 npm test` simule plus de combats (plus lent, plus exhaustif).

## Mettre en ligne (Cloudflare Pages)

- **Commande de build** : `npm run build`
- **Dossier de sortie** : `dist`

Le site n'a besoin d'aucun serveur : c'est une page statique.

## Organisation du code

```
index.html               page unique, charge src/main.js
public/assets/           toutes les images (servies telles quelles sous /assets/...)
src/
  main.js                point d'entrée : boucle du jeu, déroulé d'une run, d'une zone, d'un nœud
  style.css              styles d'origine
  interface.css          mise en page mobile, boîte de confirmation, aide du sort choisi
  data/                  contenu du jeu (à modifier pour équilibrer / ajouter du contenu)
    sorts.json           sorts des classes et des monstres
    classes.json         classes jouables (stats, éléments, sorts)
    monstres.json        monstres, boss, archimonstres
    combats.json         compositions des combats
    poolsZones.json      combats normaux / élites / boss de chaque zone
    equipements.json     équipements et leurs paliers de rareté
    butinZones.json      objets lâchés dans chaque zone
    succes.json          succès et quêtes
    reliques.json        reliques de boss
    panoplies.json       paliers de bonus des panoplies
    secrets.json         donjon secret de chaque monde (combat, butin)
    ajustementsZones.json puissance des monstres par zone (réglée par simulation)
    creatures.json       créatures et tourelles invoquées par les héros (Osamodas, Steamer)
    index.js             Dofus, zones et mondes (+ ré-export des JSON)
  jeu/                   règles hors combat
    config.js            constantes : XP, carte, raretés, économie, difficultés
    progression.js       niveaux, caractéristiques, effets des Dofus en combat
    run.js               équipe, recrutement, équipement, création des monstres, difficulté
    economie.js          kamas, hôtel de vente, forgemagie
    quetes.js            quêtes et succès
    suiviCombat.js       statistiques d'un combat (pour les quêtes)
    obtention.js         textes d'aide : où trouver un objet, un boss, comment faire une quête
    objectifs.js         objectifs de succès réalisables dans le combat qui commence
    inventaire.js        comparer un objet à celui porté, regrouper les doublons
    defis.js             défis de combat (Premier, Dernier, Blitzkrieg, Survivant…)
    rencontres.js        cases « Rencontre » : bénédictions, idoles, coffre, marchand, traque, clé
    secret.js            donjons secrets : clé, monstres à la puissance de la zone, récompenses
    panoplies.js         bonus de panoplie par palier (2, 3, 4 pièces)
  combat/                moteur de combat (sans affichage)
    stats.js             calculs : cibles valides, esquive, critique, résistances, dégâts
    effets.js            dégâts infligés, soins, boucliers, effets de début/fin de tour, invocations
    sorts.js             résolution de chaque type de sort
    moteur.js            ordre de jeu et boucle des tours
    ia.js                comportement des monstres (et des créatures invoquées par les héros)
    classes.js           mécaniques des classes ajoutées : infection, créatures, états, marques…
  carte/generation.js    génération de la carte d'une zone
  sauvegarde/            localStorage : paramètres, run en cours, progression (meta), export/import
  ui/                    affichage
    commun.js            utilitaires d'affichage, images, infobulles, fiches d'objets
    combat.js            écran de combat
    objectifs.js         fenêtre « Objectifs dans ce combat »
    collection.js        aides pour le bestiaire et l'armurerie
    ecrans/              un fichier par écran (accueil, carte, rencontre, taverne, HDV, succès…)
```

## Tests

- `tests/donnees.test.js` : chaque sort, monstre, combat, objet, succès et image référencé existe.
  À lancer après chaque modification des JSON.
- `tests/classes.test.js`, `tests/dofus.test.js`, `tests/succes.test.js`, `tests/objectifs.test.js`,
  `tests/inventaire.test.js`, `tests/mondes.test.js` :
  mécaniques des classes ajoutées, effets des Dofus, quêtes qui les débloquent, objectifs et indices,
  contenu des mondes 3 à 5 et défis Duo / Premier / Dernier.
- `tests/fuzz-combat.test.js` : joue des centaines de combats complets avec des équipes, niveaux,
  équipements, difficultés et Dofus tirés au hasard, et vérifie qu'aucun plantage, boucle infinie
  ou état incohérent (PV négatifs, PA invalides…) ne se produit.

## Sauvegardes

Les sauvegardes des joueurs sont dans le `localStorage` du navigateur, sous les clés
`rld_meta_v0`, `rld_settings_v0` et `rld_run_v0`. Elles restent compatibles avec la version
actuellement en ligne tant que le jeu est publié sur le même nom de domaine.

## Historique de cette version du code

Ce dépôt a été **reconstruit à partir de la version publiée** sur
https://roguelitedofus.pages.dev/ (le dépôt d'origine n'étant plus accessible) :

- les données du jeu (`src/data/*.json`) sont identiques à l'original ;
- le code a été découpé en modules et les fonctions, constantes et variables globales ont reçu
  des noms descriptifs (les noms d'origine avaient disparu à la compilation) ;
- les commentaires et les types TypeScript d'origine sont perdus ; à l'intérieur des fonctions,
  certaines variables locales gardent des noms courts (`e`, `t`, `n`…) — à renommer au fil des
  modifications ;
- le comportement a été vérifié identique à la version en ligne (même partie rejouée avec le
  même hasard sur les deux versions, même affichage à chaque étape).
