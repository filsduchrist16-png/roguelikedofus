# Plan d'améliorations de Roguefus Lite

Ce document est destiné à un agent Claude Code qui l'exécute tâche par tâche. Il vient d'un audit
complet du dépôt : gameplay et contenu, qualité de code et tests, UI/UX et accessibilité, plus les
limites connues des dernières sessions. Les numéros de ligne sont indicatifs : ils bougent quand le
code change, donc retrouve toujours l'endroit par le nom de la fonction (`grep -n`).

---

## 0. Règles de travail (à lire avant toute tâche)

### Le projet

- Jeu roguelite web en JavaScript (Vite 6, vitest, prettier), inspiré de Dofus. Tout le texte du jeu
  et les commentaires sont en **français**.
- `src/data/*.json` : données (classes, sorts, monstres, combats, zones, objets, panoplies, succès…).
- `src/jeu/` : logique de run, inventaire, quêtes, économie, config.
- `src/combat/` : moteur de combat, sorts, effets, IA.
- `src/carte/` : génération de la carte d'une zone.
- `src/sauvegarde/` : localStorage, méta-progression, export/import, sauvegarde en ligne.
- `src/ui/` : écrans (`ecrans/*.js`), combat (`combat.js`), fonctions communes (`commun.js`).
- CSS : `src/style.css`, `src/interface.css`, `src/visuel.css`, puis `src/confort-*.css`, importés dans
  cet ordre dans `src/main.js`.
- `tests/*.test.js` : vitest. `outils/simulation/simrun.mjs` : simulation de runs complètes.
- `CHANGELOG.md` : chaque lot de changements y est décrit, en tête de fichier.

### Commandes

- `npm install` : une seule fois au début.
- `npx vitest run` : tous les tests. Ils doivent rester **tous verts** après chaque tâche.
- `npx prettier --write src tests CHANGELOG.md` : formatage. Lance-le séparément de vitest.
- `npm run dev` : serveur local sur http://localhost:5173.
- `npm run sim -- t1,t3,t5 30` : simulation de 30 runs par monde (lent, plusieurs minutes).
- `bash outils/artefact/construire.sh` : construit la version claude.ai dans `dist-artefact/` à partir
  du **dernier commit**, donc commite avant de construire.

### Méthode, pour chaque tâche

1. **Lis** les fichiers concernés et **confirme** le problème décrit. S'il n'existe pas ou plus, note-le
   dans ton rapport et passe à la suite.
2. Quand c'est possible, **écris d'abord un test qui échoue** dans `tests/`, puis corrige.
3. Fais la **plus petite modification** qui règle le problème. Pas de refonte non demandée. Suis le
   style du fichier : commentaires en français, chaînes entre backticks, noms en français.
4. Lance `npx vitest run`, puis `npx prettier --write` sur les fichiers modifiés.
5. Pour une tâche d'interface : vérifie dans un navigateur avec Playwright. Chromium est déjà installé,
   `executablePath: '/opt/pw-browsers/chromium'`. Fais des captures en iPhone 13 (390×844) et en PC
   (1280×860), contrôle l'absence d'erreur JS (`page.on('pageerror')`) et de défilement horizontal.
6. Ajoute une ligne dans `CHANGELOG.md`, sous un titre de lot en tête de fichier.
7. **Un commit par tâche**, message en français à l'impératif, qui commence par l'identifiant de la
   tâche (ex. `B1 : …`).

### Interdits

- Ne pousse pas (`git push`) et n'ouvre pas de pull request sans demande explicite.
- N'écris aucun identifiant de modèle d'IA dans le dépôt.
- Ne casse pas les **sauvegardes existantes**. Les clés localStorage sont `rld_meta_v0`,
  `rld_run_v0`, `rld_settings_v0`, `rld_sync_v0` et `rld_backup_v0`, et les identifiants de quêtes,
  objets et Dofus ne changent pas. Une migration doit rester tolérante aux anciennes données.
- Ne modifie pas les sorts des classes ni les valeurs d'objets sans que la tâche le demande.

### Livrer une version (à la fin d'un lot, ou quand l'utilisateur le demande)

1. `git add -A && git commit` (voir plus haut).
2. `bash outils/artefact/construire.sh`. Il produit `dist-artefact/roguefus-lite.html`,
   `dist-artefact/assets/*` et `dist-artefact/paquets/*.json`.
3. Publie sur l'artefact existant `https://claude.ai/artifact/K3x9YigYz1DC9yT43S6z2m` avec l'outil
   Artifact, dans cet ordre :
   1. lis-le d'abord (`action: "read"`) puis liste ses fichiers (`action: "list"`, `scope: "files"`) ;
   2. publie avec `url` = l'artefact, `file_path` = `dist-artefact/roguefus-lite.html`,
      `root` = `dist-artefact` ;
   3. dans `files`, mets les nouveaux `assets/…` et `paquets/…`, et passe à `null` les anciens
      `assets/index-*.js`, `assets/main-*.js` et `assets/main-*.css` qui ne sont plus produits ;
   4. ne passe **pas** `capabilities` : l'artefact a `db`, `downloads` et `user`, et les omettre les
      conserve.
4. Zip sans `.git` : `git archive --format=zip -o roguefus-lite.zip HEAD` (environ 30 Mo).

---

## LOT A — Bugs bloquants et pertes de données (priorité 1)

### A1. Rattraper les erreurs de la boucle principale

- **Où :** `src/main.js`, fonction `boucleJeu` et l'appel `boucleJeu();` en fin de fichier.
- **Problème :** aucun `try/catch` ni écouteur `unhandledrejection`. Une exception dans un écran ou
  dans le moteur fige le jeu sans message.
- **À faire :**
  - entourer le corps de l'itération de `boucleJeu` d'un `try/catch` qui affiche
    `ecranMessage("Oups", "Une erreur est survenue : <message>. Retour à l'accueil.")` puis continue la
    boucle (retour à l'accueil) ;
  - ajouter `window.addEventListener("unhandledrejection", (e) => console.error(e.reason))`.
- **Vérification :** ajoute temporairement `throw new Error("test")` dans `ecranCarte`, lance le jeu :
  le message apparaît et l'accueil revient. Retire le `throw`.

### A2. Ne plus écraser une méta-progression un peu abîmée

- **Où :** `src/sauvegarde/meta.js`, `chargerMeta`, et `normaliserReliques` comme modèle.
- **Problème :**
  - `t.dofus.map` plante si `dofus` n'est pas un tableau, et un `t` null fait aussi planter ;
  - le `catch` renvoie alors une méta **vierge**, que le démarrage réécrit aussitôt : la progression est
    perdue ;
  - `archis` n'est pas validé.
- **À faire :**
  - valider champ par champ : `Array.isArray(x) ? x : []`, filtrer `dofus` sur `DOFUS[d?.id]`,
    `archis` sur des chaînes, `quetes.faites` sur des chaînes ;
  - garder les autres champs valides ;
  - si `JSON.parse` échoue, copier la chaîne brute dans `rld_meta_corrompue_v0` avant de renvoyer la
    méta par défaut.
- **Tests à ajouter** dans `tests/meta-migration.test.js` :
  - `{"dofus":{},"archis":["x"],"runs":3}` → `runs === 3` et `archis` conservé ;
  - `"null"` → copie brute présente dans `rld_meta_corrompue_v0`.

### A3. Refuser une run sauvegardée hors limites

- **Où :** `src/sauvegarde/run.js`, `chargerRun`.
- **Problème :** `zoneIdx` est seulement testé comme nombre.
  - `zoneIdx >= nombre de zones` : la run est comptée **gagnée** sans jouer, et l'ascension est
    débloquée.
  - `zoneIdx < 0` : le jeu plante.
  - `trancheId` inconnu : le jeu se rabat sans rien dire sur le Monde 1.
- **À faire :** exiger que `zoneIdx` soit un entier, `>= 0` et inférieur au nombre de zones du monde,
  et que `trancheId` corresponde à un monde existant (`MONDES`). Sinon, renvoyer `null`.
- **Tests à ajouter** dans `tests/sauvegarde-run.test.js` :
  - `zoneIdx: 99` → `null` ;
  - `zoneIdx: -1` → `null` ;
  - `classeId` inconnu → `null` ;
  - une run valide est rechargée à l'identique.

### A4. Rendre l'effet du Dofus Ocre activable

- **Où :** `src/sauvegarde/meta.js`, `tousArchisCaptures` et `bonusDofus`, et `src/data/monstres.json`
  (`bitouf_des_plaines`).
- **Problème :**
  - le +1 PA d'Ocre exige la capture de **tous** les monstres qui ont un `archiNom` (146) ;
  - or `bitouf_des_plaines` (« Toufou le Benêt ») n'apparaît dans aucun combat ;
  - le succès se termine quand même (il ne compte que 145 archis), donc le joueur reçoit un Dofus sans
    effet.
- **À faire :**
  - ne plus conditionner le PA d'Ocre : le Dofus n'est remis qu'une fois son succès fini ;
  - ajouter un test de données : tout monstre avec `archiNom` apparaît dans au moins un combat de
    `poolsZones` (ou dans `MONSTRES_RARES`) ;
  - corriger `bitouf_des_plaines` : l'ajouter à un combat de sa zone, ou retirer son `archiNom`.
- **Vérification :** avec `meta.dofus = [{id:"dofus_ocre"}]`, on doit avoir
  `bonusDofus(meta).paBonus === 1`.

### A5. Import et copie de secours atomiques

- **Où :**
  - `src/sauvegarde/export.js` : `importerSauvegarde`, `restaurerSecours`, `lireSauvegarde` ;
  - `src/sauvegarde/nuage.js` : `recupererNuage` ;
  - `src/ui/ecrans/parametres.js`.
- **Problème :**
  - les 3 clés s'écrivent une par une : une erreur de quota en cours de route mélange deux parties ;
  - le retour de `sauvegardeDeSecours()` est ignoré alors que le texte promet une copie ;
  - `recupererNuage` supprime la copie de secours sans prévenir.
- **À faire :**
  - lire les anciennes valeurs, préparer les 3 chaînes, écrire, et en cas d'exception réécrire les
    anciennes valeurs ;
  - refuser un import dont `version > 1` ou dont les `donnees[k]` ne sont pas des objets ;
  - si la copie de secours échoue, le dire dans la confirmation ;
  - prévenir quand la copie de secours est supprimée pour faire de la place.
- **Test :** un `localStorage` simulé dont `setItem` lève à la 2e écriture laisse les 3 clés intactes.

### A6. Signaler les sauvegardes qui échouent

- **Où :** `src/sauvegarde/run.js` (`sauverRun`), `meta.js` (`sauverMeta`), `parametres.js`
  (`sauverParametres`). Tous font `try { setItem } catch {}`.
- **À faire :**
  - renvoyer `true` ou `false` ;
  - au premier échec de la session, `afficherBandeau("⚠ Sauvegarde impossible : stockage du navigateur
plein")`, une seule fois.
- **Test :** un `setItem` qui lève → `sauverRun` renvoie `false`.

### A7. Fin du tour par Espace alors qu'un bouton a le focus

- **Où :** `src/ui/combat.js`, écouteur `keydown` global (cherche `toucheFinTour`).
- **Problème :** la touche par défaut est Espace. Un joueur au clavier qui tabule sur un sort et appuie
  sur Espace termine son tour.
- **À faire :** ignorer la touche de fin de tour si
  `document.activeElement?.closest('button, a[href], input, textarea, select, [role="button"]')`.
- **Vérification :** Playwright PC, Tab jusqu'à un sort puis Espace : le sort est sélectionné et le tour
  continue.

### A8. Taverne : remplacer un héros sans confirmation

- **Où :** `src/ui/ecrans/taverne.js`, clic sur une carte d'équipe quand l'équipe est pleine.
- **À faire :**
  - `await demanderConfirmation("Remplacer <nom> (niv. X) par <recrue> ? Son équipement retourne dans
l'inventaire.", "Remplacer")` (`demanderConfirmation` est dans `src/ui/commun.js`) ;
  - ajouter la classe `btn-retour` au bouton Annuler, pour qu'Échap fonctionne.

### A9. « Réinitialiser les Dofus » ne réinitialise rien

- **Où :** `src/ui/ecrans/parametres.js` (texte et action), `src/sauvegarde/meta.js`
  (`reinitialiserDofus`, `donnerDofusEnAttente`).
- **Problème :** les quêtes restent faites, donc tous les Dofus reviennent au prochain combat. Le
  Kaliptus est même retiré, ce qui donne un reroll gratuit.
- **À faire :**
  - effacer aussi les quêtes des succès de Dofus (`succesDuDofus`) ;
  - confirmer avec `demanderConfirmation` ;
  - prendre `sauvegardeDeSecours()` avant d'effacer.
- **Test :** `reinitialiserDofus(meta)` puis `dofusDebloquables(meta).length === 0`.

---

## LOT B — Équilibrage et cohérence des règles (priorité 2)

Pour chaque tâche de ce lot, lance la simulation avant et après, et note les taux de victoire dans le
CHANGELOG :

```
npm run sim -- t1,t3,t5 30
```

### B1. Le soin plafonne dès le niveau 21

- **Où :** `src/jeu/progression.js` (`multiplicateurSoin`) et `src/combat/stats.js`.
- **Problème :** la formule est `1 + min(0.5, (soin + meilleur élément) × 0.005)`. Au-delà d'environ
  100 points, la stat Soin, le Jyfus et la bénédiction d'Eniripsa ne servent plus à rien.
- **À faire :** séparer les deux sources, par exemple
  `1 + min(0.5, statElement × 0.002) + soin × 0.005`, sans plafond commun.
- **Test :** `multiplicateurSoin({soin:0},300)` est différent de `multiplicateurSoin({soin:100},300)`.

### B2. Esquive d'Agilité trop forte

- **Où :** `src/combat/stats.js`, esquive égale à `agilite × 0.002` avec un plafond de 0,5.
- **Problème :** les classes Air atteignent 50 % d'esquive au niveau 75 et cumulent le critique ; les
  autres classes n'ont rien d'équivalent.
- **À faire :** rendement décroissant `a / (a + 400)` avec un plafond de 0,35.
- **Vérification :** simulation, plus un test de valeurs aux niveaux 50, 100 et 200.

### B3. Tir puissant (Cra) cumulable sans limite

- **Où :** `src/data/sorts.json` (sort Tir puissant) et `appliquerEffet` dans `src/combat/stats.js`.
- **Problème :** relancé à chaque tour, il donne +45 % de critique permanent pour 2 PA.
- **À faire :** ajouter une clé `nonCumulable` qui rafraîchit la durée au lieu d'empiler (s'inspirer de
  Griffe joueuse), ou un rechargement de 3 tours. Mettre la description à jour.
- **Test :** 3 lancers en 3 tours → critique total ≤ 15 %.

### B4. Colère de Iop sans plafond

- **Où :** `src/combat/stats.js`, bonus de Colère (+50 % par lancer).
- **À faire :** plafonner à +150 % et l'indiquer dans la description du sort.

### B5. « Équiper le meilleur » valorise un effet négatif

- **Où :** `src/jeu/inventaire.js`, `cleEquipement` (`VALEUR_EFFET` compté sans signe).
- **Problème :** la Chance d'Ecaflip (`paGamble` : 1/3 de +1 PA, 2/3 de −1 PA) fait perdre −0,33 PA
  par tour en moyenne, mais elle est préférée.
- **À faire :** compter `paGamble` comme une espérance de PA dans `pa` (en fraction), ne pas le compter
  comme effet positif, et vérifier chaque clé de `NOMS_EFFETS` (bonus ou malus).
- **Test :** un anneau `paGamble` n'est pas équipé à la place d'un anneau équivalent sans effet.

### B6. Panoplies de boss impossibles à compléter

- **Où :**
  - `src/data/butinZones.json` (pools `boss` et `elites`) ;
  - `src/jeu/run.js` (`tirerButin`) ;
  - `src/jeu/economie.js` (`genererStockHdv`).
- **Problème :** environ 34 panoplies n'ont leurs pièces qu'au butin du boss, qui se bat une seule fois
  par run (Bouftou Royal, Dragon Cochon, Minotoror, Rat Blanc et Rat Noir…). C'est pareil pour les
  panoplies « élite seulement ».
- **À faire (choisir une option et l'expliquer dans le CHANGELOG) :**
  1. ajouter les pièces de boss au pool `elites` de la même zone ;
  2. ou faire que l'HDV propose en priorité une pièce manquante de la panoplie la plus avancée de
     l'équipe.
- **Vérification :** simulation avec un compteur « palier PA de panoplie atteint » ; il doit monter.

### B7. Panoplies des donjons secrets

- **Où :** `src/main.js` (victoire de donjon secret : un seul objet), `src/jeu/secret.js`.
- **Problème :** les panoplies en Mousse et Boufcoul (7 pièces) sont impossibles à compléter.
- **À faire :** donner 2 objets par victoire de donjon secret, ou ajouter ses pièces au stock de l'HDV
  après la victoire.

### B8. Le Monde 5 n'a pas d'archimonstre, mais Otomai et le Philtre sont proposés

- **Où :**
  - `src/jeu/run.js`, `noeudsExclus` ;
  - `src/main.js`, rencontre marchand (Philtre).
- **À faire :**
  - exclure la case `otomai` et l'offre de Philtre quand aucune zone du monde n'a d'archimonstre ;
  - option bonus (lot E) : ajouter des archimonstres au Monde 5.
- **Test :** `genererCarte` sur une zone du Monde 5 ne produit jamais de case `otomai`.

### B9. XP : offres inutiles au Monde 5 et donjon sans XP

- **Où :**
  - `src/main.js` (marchand : Parchemin d'expérience ; idole Nahuatl ; défi « +30 % d'XP ») ;
  - `src/jeu/config.js` (`XP_PAR_COMBAT` sans entrée `donjon`).
- **À faire :**
  - au Monde 5 (niveau 200), masquer le Parchemin et Nahuatl et retirer « XP » du texte du défi ;
  - pour le donjon : soit lui donner de l'XP (`donjon` dans `XP_PAR_COMBAT`, puis simulation), soit
    écrire dans les Règles que le donjon ne donne pas d'XP.

### B10. Défi « Survivant » et objectifs « sans K.O. » faussés

- **Où :**
  - `src/jeu/defis.js` (`etatDefi`) et `src/jeu/objectifs.js` (`etatObjectif`) ;
  - pour comparer : `src/jeu/suiviCombat.js` (`herosKO`).
- **Problème :** les héros déjà K.O. avant le combat comptent comme tombés : l'écran affiche ✖ alors que
  la récompense est donnée.
- **À faire :** ne compter que les héros debout au départ, comme `herosKO`.
- **Test :** un héros à 0 PV au départ, victoire sans autre K.O. → l'état n'est pas `rate`.

### B11. Les 6 Pious du Monde 1 : environ 54 runs de grind

- **Où :** `src/jeu/config.js` (`MONSTRES_RARES`) et `src/jeu/run.js` (`tirerMonstreRare`).
- **À faire :** appliquer à ces monstres le multiplicateur « jamais capturé » (`multNouveau`) et la jauge
  de traque, ou monter la chance à 2 %.
- **Vérification :** un calcul ou une simulation donne moins de 20 runs en moyenne.

### B12. Plus de variété de combats

- **Où :** `src/data/poolsZones.json` et `src/data/combats.json`.
- **Problème :** chaque zone n'a que 3 combats normaux et 1 combat élite. Il n'y a que 3 affixes d'élite.
  Les monstres `rat_sio`, `crapeur`, `bwork_elemental_de_terre`, `harpo` et `n_yalg`, ainsi que le sort
  `affaiblissement_t3`, ne servent nulle part.
- **À faire :**
  - passer à 5 combats normaux par zone, avec des monstres de la même zone et un nombre d'ennemis
    proche des combats existants ;
  - réutiliser les monstres orphelins ;
  - ajouter 3 affixes d'élite qui réutilisent des états déjà gérés par le moteur (`armure`,
    `reductionDegats`, `mueElementaire`…).
- **Vérification :**
  - tests de données (`donnees.test.js`, `quetes-faisables.test.js`) ;
  - simulation : les taux de victoire ne bougent pas de plus de 10 points.

### B13. Petites incohérences de règles

- **Anneau Tissé :** `esquiveParPiece` ne s'applique jamais, car il exige une panoplie. Remplacer par
  `esquiveBonus: 0.025` dans `equipements.json`.
- **Mot galvanisant :** le soin sur la durée se base sur la Vitalité au lieu des PV max
  (`src/combat/effets.js`). Passer aux PV max.
- **Idole :** le bonus de kamas ne s'applique ni au donjon ni au donjon secret (`src/main.js`). Aligner
  sur les combats normaux.
- **Clé jouée aux dés :** gratuite quand on n'a plus de kamas. Exiger les kamas de la mise.
- **Défis Premier/Dernier :** les invocations sont comptées différemment entre défis et quêtes
  (`suiviCombat.js`). Aligner : ignorer les invocations.
- **Taverne en Ultime :** le texte « tout soin hors combat disparaît » est faux (`taverne.js`). Le
  corriger.
- **HDV :** un achat annulé reste enregistré dans la collection (`hdv.js`), ce qui valide la quête de la
  Couronne du Wa Wabbit. Retirer l'objet de la collection à l'annulation, s'il n'y était pas avant.
- **Plusieurs effets du même type :** `proprieteEquipement` (`run.js`) prend le premier trouvé. Prendre
  le plus fort.

### B14. Difficulté : vérifier le dernier réglage

- **Contexte :** `src/jeu/config.js` (`PUISSANCE_PAR_TYPE`), `src/data/ajustementsDonjons.json` et
  `ajustementsZones.json`. Le dernier réglage (combats ×1,03 → ×1,2 et combats durs ×1,03 → ×1,35)
  n'a pas été simulé tel quel. Le joueur trouvait le jeu trop facile.
- **À faire :**
  - simuler en Normal (`npm run sim -- t1,t2,t3,t4,t5 40`) puis en Difficile (argument d'ascension 1) ;
  - noter les taux dans le CHANGELOG, sans changer les valeurs sauf si un monde est sous 15 % de
    victoires du robot.

---

## LOT C — UI/UX et accessibilité (priorité 2)

### C1. « Fin du tour » d'un seul appui sur mobile

- **Où :** `src/ui/combat.js` (bouton `#fin-tour`).
- **À faire :** sur écran tactile, s'il reste des PA et un sort jouable, le 1er appui affiche « Encore
  N PA : confirmer » pendant 3 s, et le 2e termine le tour.

### C2. Cibles tactiles sous 44 px

Passer chaque élément à `min-height:44px; min-width:44px` sous
`@media (hover:none), (width<=700px)`, dans le fichier `confort-*.css` de l'écran concerné.

| Élément                                     | Taille actuelle                    |
| ------------------------------------------- | ---------------------------------- |
| `.combat .sort` (sorts en combat)           | 40 px ; mettre 44 px et `gap: 6px` |
| `.cp-fermer` (fermeture du panneau de case) | 36 px                              |
| `.vitesse-combat`                           | 34 px                              |
| `.filtre-btn`                               | 36 px                              |
| `.tri-btn`                                  | 34 px                              |
| `.fiche-heros-boutons .petit`               | environ 26 px                      |
| `.form-el-btn`                              | environ 26 px                      |
| `.sort-info`                                | environ 28 px                      |
| `.btn-regles` / `.btn-discord`              | environ 33 px                      |
| étoiles de difficulté                       | environ 36 px de large             |

- **Vérification :** script Playwright mobile qui liste les `button, [role=button], a` visibles de
  chaque écran plus petits que 40 px. Le résultat attendu est vide.

### C3. Textes sous 11 px sur mobile

- **Où :** légendes du menu d'accueil (`visuel.css`), légendes de la barre de la carte, résistances et
  badges d'état en combat, nom d'emplacement et Tier de l'équipement, texte « Téméraire » de la forge.
- **À faire :** plancher `font-size: max(11px, …)`.
- **Vérification :** Playwright, `getComputedStyle(el).fontSize >= 11px` pour tous les textes visibles.

### C4. Contraste du focus et du filtre actif

- **Où :** `src/style.css` (contour de focus `--cyan: #ef7d1a`) et `.filtre-btn.actif`.
- **Problème :** contrastes d'environ 2,1:1 et 2,8:1.
- **À faire :** contour de focus `#7d550d` avec un halo clair ; filtre actif en texte `#3a2402` sur
  l'orange.

### C5. Annuler « Équiper le meilleur »

- **Où :** `src/ui/ecrans/equipement.js` et `butin.js`.
- **À faire :** mémoriser les échanges (`planEquiper` renvoie `remplace`) et afficher « ✓ n objets
  équipés · Annuler », qui remet les anciens objets.

### C6. Clavier dans l'écran Équipement

- **Où :** `equipement.js`.
- **À faire :**
  - emplacement vide : Entrée et Espace doivent faire comme le clic (filtrer l'inventaire) ;
  - après fermeture de la fiche ou un équipement, remettre le focus sur l'élément d'origine ;
  - utiliser l'attribut `data-*` mémorisé pour retrouver cet élément.

### C7. Sauvegarde en ligne dans Paramètres

- **Où :** `src/ui/ecrans/parametres.js` (boutons Envoyer et Récupérer).
- **À faire :**
  - confirmer avec `demanderConfirmation` et le résumé des deux parties, comme le bandeau de l'accueil
    (`texteResume`, `resumePartieLocale`, `infoNuage`) ;
  - afficher le message de résultat sous les boutons, avec `role="status"` ;
  - libellés « Envoi… » et « Récupération… » pendant l'attente ;
  - appeler le réseau une seule fois à l'ouverture de l'écran, pas à chaque redessin.

### C8. Carte : contenu des cases lointaines

- **Où :** `src/ui/ecrans/carte.js`.
- **Problème :** les cases non atteignables sont `disabled`, donc leur contenu est illisible au toucher.
- **À faire :**
  - remplacer `disabled` par `aria-disabled="true"`, sans action « y aller » ;
  - au toucher, afficher le panneau `.case-panneau` sans le bouton `.cp-aller`.

### C9. Forgemagie : kamas manquants visibles sur mobile

- **Où :** `forgemagie.js`.
- **À faire :** afficher `<span class="hdv-manque">il manque X k</span>` dans le bouton, comme l'HDV,
  au lieu de le mettre seulement dans `title`.

### C10. Réduire les animations

- **À faire :**
  - un bloc `@media (prefers-reduced-motion: reduce)` qui couvre `.pv-barre.crit`, `fx-flash`, `fx-rise`,
    `fx-pop` et `confirm-apparition` ;
  - un utilitaire `comportementDefilement()` qui renvoie `auto` ou `smooth`, utilisé par tous les
    `scrollIntoView` / `scrollBy` ;
  - une option « Réduire les animations » dans Paramètres, qui pose une classe sur `body`.

### C11. Bouton et geste « retour » du téléphone

- **Où :** `src/ui/commun.js` (`afficherEcran`) et `src/main.js`.
- **Problème :** le retour Android ou le geste iOS quitte l'artefact.
- **À faire :**
  - `history.pushState` à chaque écran ;
  - sur `popstate`, cliquer `.btn-retour` s'il existe ; sinon (en combat) demander confirmation et
    re-pousser l'état ;
  - sauvegarder la run sur `visibilitychange` quand on n'est pas en combat.

### C12. Première partie : astuces contextuelles

- **À faire :**
  - un drapeau `parametres.vuTuto` ;
  - pendant la première run, un bandeau non bloquant (`afficherBandeau`) au 1er écran de carte, au 1er
    tour de combat (lignes avant et arrière, PA), au 1er butin (⚡ Équiper le meilleur) et à la 1re
    taverne ;
  - « Revoir les astuces » dans Paramètres.

### C13. Réglages d'accessibilité

- **À faire :**
  - « Taille du texte » 100, 115 ou 130 % via `document.documentElement.style.fontSize` (tout est en
    rem) ;
  - « Couleurs adaptées » : rareté écrite (C/R/É/L) sur les emplacements, motif sur les barres de PV
    ennemies.
- **Vérification :** à 130 %, pas de défilement horizontal en combat, sur la carte ni dans
  l'équipement.

### C14. Vocabulaire et textes

- « Trier par Tier (toile d'obtention) » devient « (zone d'obtention) » (`equipement.js`).
- « Forgemage » et « Forgemagie » : n'utiliser que « Forgemagie ».
- « Otomai » et « Otomaï » : n'en garder qu'une forme.
- La légende de menu « Réglages » devient « Paramètres ».
- Le bouton « Rejouer » de la carte (qui abandonne la run) devient « Recommencer ».
- Règles : « le bestiaire complet donne le Dofus Ocre » est inexact (il faut aussi gagner le Monde 5).
- Taverne avec équipe pleine : le bouton « Équipe déjà en pleine forme » devient « Partir (équipe déjà
  en pleine forme) ».
- Accueil : en cas d'échec d'« Garder celle d'ici », afficher un bandeau d'erreur.

### C15. Informations seulement dans un `title`, donc invisibles au toucher

- **Où :**
  - pièges du Sram en combat ;
  - texte « sans dégâts en plus » de l'équipement ;
  - jauge de traque du Bestiaire ;
  - « Kamas perdus à la mort » sur la carte ;
  - « Plus assez de kamas pour annuler » à l'HDV.
- **À faire :** passer en `data-tip`, les infobulles tactiles déjà gérées dans `commun.js`.

### C16. Accessibilité des lecteurs d'écran

- Journal de combat : n'ajouter que la nouvelle ligne avec `appendChild`, au lieu de réécrire tout
  `innerHTML`.
- `aria-pressed` sur les cartes à choisir : classe, succès, interrupteurs de Paramètres, cases de
  Formation.
- Un `<h1 class="sr-only">` sur l'accueil, la carte et le combat.
- État des quêtes de succès en texte masqué (`sr-only`) au lieu d'un `aria-label` sur un `span`.
- La boîte de confirmation garde le focus (Tab ne sort pas) et le rend au bouton d'origine.

### C17. Divers

- Bandeaux : durée doublée si le texte dépasse 60 caractères, et pause au survol.
- Titre de combat trop long sur combat dur : mettre l'affixe en pastille sous le titre.
- Équipement : supprimer le message « sac vide » en double.
- Paramètres : masquer « Touche Terminer le tour » sur écran tactile.
- Formation : préciser qu'on peut aussi toucher deux jetons pour l'ordre de jeu.
- Polices : les graisses 700 et 900 pointent vers `nunito-400.woff2` (gras synthétique). Ajouter de
  vrais fichiers.

### C18. Limites connues des dernières sessions

- **Combat mobile :** avec 5 ou 6 ennemis, la barre du bas couvre environ 30 % de l'écran pendant la
  visée. Réduire la barre (sorts sur une ligne défilante) quand une cible est attendue.
- **Équipement mobile :** avec 50 objets, la page fait environ 30 000 px. Rendre les filtres collants
  (`position: sticky`) et passer à une grille de 2 colonnes pour les cartes d'inventaire.
- **Fin de run :**
  - le bouton « Retour » orange (de `commun.js`) est plus voyant que « Rejouer » : réduire sa taille sur
    cet écran ;
  - ajouter au bilan la liste des objets obtenus et le nombre d'ennemis vaincus, en les ajoutant à
    `run.stats`.

---

## LOT D — Qualité de code, tests et outillage (priorité 3)

### D1. Plan d'équipement périmé après la forgemagie

- **Où :** `src/jeu/inventaire.js` (`planEquiper` : sa clé de cache ne contient que l'identité des
  objets) et `src/jeu/economie.js` (`forgerObjet` modifie l'objet sur place).
- **À faire :** ajouter `inst.rarete` et les stats à la clé de cache, ou exporter `invaliderPlan()` et
  l'appeler depuis `forgerObjet`.
- **Test :** `planEquiper`, puis `forgerObjet` sur un objet de l'inventaire, puis `planEquiper` donne le
  même résultat qu'un calcul sur une copie neuve.

### D2. Une seule fonction d'évaluation d'équipement

- **Où :** `src/jeu/run.js` (fonction privée `valeurEquipement`, qui choisit l'anneau) et
  `src/jeu/inventaire.js` (`cleEquipement`, `valeurEquipement`).
- **À faire :** créer `src/jeu/evaluation.js` qui contient `cleEquipement`, `valeurEquipement` et
  `degatsMoyensArme`. Il n'importe que `bonusEquipement` et `pvMaxPerso`, ou reçoit ces fonctions en
  paramètre pour éviter un import circulaire. Faire utiliser ce module par `run.js` et `inventaire.js`.
- **Vérification :** `grep -rn "function valeurEquipement" src` donne une seule ligne.

### D3. Écouteurs en double

- `parametres.js` :
  - la capture de touche peut ajouter plusieurs `keydown` : retirer l'ancien avant d'en ajouter un ;
  - les promesses du nuage qui se résolvent après un nouveau rendu ajoutent des `click` en double :
    utiliser un jeton de rendu.
- `src/ui/combat.js` : les écouteurs de la barre de sorts sont branchés par `queueMicrotask` à chaque
  rendu. Passer à un seul écouteur délégué sur `#cb-barre`.

### D4. Code mort

Vérifier chaque élément avec `grep -rn "<nom>" src tests outils index.html` avant de supprimer.

- **Exports jamais utilisés :**
  - `IMG_TERMINER`, `resumeBonus` et `htmlComparaisonObjet` (`src/ui/commun.js`) ;
  - `ecranZaap` (`src/ui/ecrans/message.js`).
- **Classes CSS jamais utilisées :**
  - `.quete-indice`, `.succes-prerequis`, `.pd-attente`, `.slot-item`, `.tabnum` ;
  - `.drop-rarete`, `.tip-boss`, `.slot-img`, `.forge-message`, `.drop-auto`.
- **Images inutilisées :** `public/assets/divers/carte_au_tresor.png`, et `menu/Terminer.png` une fois
  `IMG_TERMINER` retiré.

### D5. Renommer les variables d'une lettre (code issu d'une version minifiée)

- **Méthode :** une fonction par commit, sans changer le comportement. Tests verts après chaque
  renommage.
- **Ordre conseillé :**
  1. `jouerCombat` (`src/main.js`) ;
  2. `infligerDegats` (`src/combat/effets.js`) ;
  3. `htmlChipsObjet` (`src/ui/commun.js`) ;
  4. table `RESOLVEURS_SORTS` (`src/combat/sorts.js`) ;
  5. `rendreCombat` et `htmlBarreSorts` (`src/ui/combat.js`) ;
  6. `executerCombat` (`src/combat/moteur.js`) ;
  7. `creerCombattantPerso` et `bonusEquipement` (`src/jeu/run.js`) ;
  8. `resoudreNoeud`, `jouerRun` et `traiterQuetes` (`src/main.js`) ;
  9. `bonusDofus` et `tirerReliques` (`src/sauvegarde/meta.js`).
- Remplacer aussi les expressions à virgule (`a && (b, c)`) par des `if`.

### D6. Tests manquants

- `tests/sauvegarde-run.test.js` : `chargerRun` et `sauverRun`, objets à rareté inconnue, objet dont
  l'emplacement a changé, migration de la version 1.
- `tests/meta-migration.test.js` : `chargerMeta` versions 1, 3 et 4 (ascension, `MIGRATION_SUCCES`,
  Dofus sous forme de chaîne).
- `tests/parametres.test.js` : normalisation de la formation et de l'ordre.
- `tests/carte.test.js` : pour 200 graines et chaque zone, le donjon est atteignable depuis le départ.
- Rendre indépendants les tests qui dépendent d'un `localStorage` laissé par un autre test
  (`confort-meta.test.js`).
- Mettre `vi.useRealTimers()` dans un `afterEach` (`nuage.test.js`).

### D7. Extraire le déroulé de la run de `main.js`

- **Problème :** `main.js` ne peut pas être importé dans un test, et `outils/simulation/simrun.mjs`
  recopie sa logique, qui a déjà divergé (multiplicateurs de kamas oubliés).
- **À faire :** extraire `resoudreNoeud`, la distribution des kamas et `jouerRencontre` dans
  `src/jeu/deroule.js`, avec les écrans passés en paramètre, et faire utiliser ce module par `simrun.mjs`.

### D8. Outillage

- Ajouter ESLint (configuration « flat ») avec les règles `no-shadow`, `no-unused-vars`, `no-sequences`
  et `eqeqeq`.
- Ajouter les scripts `"lint"` et `"check": "prettier --check . && eslint . && vitest run"`.
- Étendre le script `format` à `tests/` et `outils/`.
- Mettre à jour le README :
  - fichiers `confort-*.css`, `nuage.js`, `telechargement.js` ;
  - `npm run sim` ;
  - `outils/artefact/construire.sh` ;
  - clés `rld_backup_v0` et `rld_sync_v0`.

### D9. Consolidation CSS (grosse tâche, à faire en dernier)

- **Constat :** 9 fichiers, environ 8 700 lignes, 69 sélecteurs définis dans plusieurs fichiers, et des
  `!important` (raretés).
- **Méthode :** captures Playwright avant et après, mobile et PC, sur l'accueil, la carte, le combat,
  l'équipement, les succès et les paramètres. Elles doivent rester identiques.
- **À faire :**
  1. un seul `:root` de variables ;
  2. fusionner chaque sélecteur en double dans le fichier de son écran, en gardant la valeur qui
     s'applique aujourd'hui ;
  3. remplacer les `!important` des raretés par une spécificité plus forte.

### D10. Performance

- **Bundle :** le JS fait 1,07 Mo, dont `equipements.json` (700 Ko). Retirer à la construction les champs
  inutiles au jeu, ou charger les données par monde.
- **Images :** 29 Mo de PNG.
  - Redimensionner au double de la taille affichée (`classes/forgelance.png` fait 1,3 Mo pour 78 px
    affichés).
  - Ajouter `loading="lazy"` sur toutes les `<img>` générées.
  - Cible : `du -sh public/assets` sous 8 Mo, ce qui ramène aussi le zip sous 30 Mo.
- **Combat :** `ciblesValides` est calculé 3 fois par rendu dans `src/ui/combat.js`. Le calculer une
  fois.
- **Équipement :** lancer `planEquiper` après le premier affichage (`requestIdleCallback`) si le calcul
  dépasse 50 ms.

---

## LOT E — Ajouts de contenu à forte valeur (priorité 4, une tâche à la fois)

### E1. Archimonstres du Monde 5

- **À faire :**
  - ajouter un `archiNom` aux monstres du Monde 5 ;
  - ajouter un succès d'archis du Monde 5 (nouvel identifiant, ne pas toucher aux anciens) ;
  - rendre Otomai, le Philtre et la Traque utiles en fin de jeu (voir B8).

### E2. Reliques utiles

- **À faire :** un emplacement « relique » qui donne un petit bonus, en réutilisant des clés d'effet que
  le moteur gère déjà (`EFFETS_DOFUS`, effets d'objets). Afficher le bonus dans le Bestiaire.

### E3. Idoles de départ

- **À faire :**
  - choisir des idoles cumulables au lancement d'une run (malus contre multiplicateur de butin, d'XP ou
    de chance de relique), sur le modèle de `IDOLES` et `DIFFICULTES` ;
  - enregistrer un score record par monde dans la méta.

### E4. Run du jour

- **À faire :**
  - une run quotidienne avec une graine fixe (le générateur de carte prend déjà un `rng`) et une
    bénédiction imposée, dans l'esprit du Dolmanax ;
  - un bouton dans l'accueil.

### E5. Nouvelles rencontres

- **Forgemage itinérant :** monter un objet d'une rareté sans risque, une fois.
- **Temple de résurrection :** relever un héros K.O. contre des kamas.
- Réutiliser les écrans existants (`rencontre.js`, `forgemagie.js`).

### E6. Dofus de fin de jeu

- **Constat :** 18 des 31 Dofus sont au Monde 5, et certains effets sont presque nuls (Ébène +1 %,
  Domakuro +1 %, Dofawa +1 PV). Le Kaliptus annonce « selon le meilleur exemplaire » alors qu'on n'en
  obtient qu'un.
- **À faire :**
  - revoir ces effets pour qu'ils soient perceptibles ;
  - corriger le texte du Kaliptus ;
  - vérifier chaque changement par la simulation.

### E7. Son (facultatif)

- **À faire :**
  - quelques sons courts (coup, soin, niveau gagné, victoire), **coupés par défaut**, avec un réglage
    dans Paramètres ;
  - respecter `prefers-reduced-motion` pour les vibrations.

### E8. Vérifications de contenu restantes

- **Domakuro** (quête « vaincre Nagate ») : confirmer avec le lore de Dofus 3 et ajuster si besoin, en
  gardant des boss existants dans les données.
- **Ivoire** (Harebourg, Meno) et **Ébène** : même vérification.
- **Vulbis** (« posséder 20 Dofus ») : le seuil est-il raisonnable ? Le CHANGELOG doit expliquer le
  choix.

---

## Ordre d'exécution conseillé

1. **Lot A**, en entier, une tâche par commit.
2. Livrer une version (section 0).
3. **Lot B** : tâches B10, B13, B5, B1, B3, B4, B2, B8, B9, B11, puis B6, B7, B12, B14 (celles qui
   demandent une simulation à la fin).
4. Livrer une version.
5. **Lot C** : C1 à C9, puis C14 à C17, puis C10 à C13 et C18.
6. Livrer une version.
7. **Lot D** : D1 à D4 et D6, puis D8, D7, D5, D10, et D9 en dernier.
8. **Lot E**, seulement si l'utilisateur le demande, une tâche à la fois.

À la fin de chaque lot, écris un court rapport en français : ce qui est fait, ce qui ne l'est pas et
pourquoi, les chiffres de simulation, et les points à valider par le joueur.
