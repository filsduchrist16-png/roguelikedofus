# Journal des modifications

## Petites finitions d'interface (mobile)

- Combat : les pastilles de coût des sorts ne sont plus coupées par le haut de la barre.
- Accueil : légendes du menu alignées sous chaque icône, plus de chevauchement avec le logo.
- Carte : le menu du haut s'estompe à droite tant qu'il reste des boutons à faire défiler.
- Équipement : sac vide = un message clair au lieu de filtres et de tris à zéro.

## Petit correctif tactile

- Choix d'équipe sur téléphone : l'archétype (Mêlée / Distance) s'écrit en toutes lettres au lieu d'une icône à infobulle inaccessible au toucher.

## Correctif : « Équiper le meilleur »

- Le bouton est maintenant **toujours présent** dans l'écran Équipement (grisé avec « Rien à améliorer »
  quand il n'y a rien à faire) et indique le nombre d'objets concernés.
- Il équipe aussi les objets « plutôt mieux » (mitigés à score positif, sans effet spécial perdu), plus
  seulement les nettes améliorations. Le plus gros gain est équipé en premier.
- Le butin utilise le même critère : « ⚡ Équiper (n) » apparaît dès qu'un objet est un progrès sûr.

## Passe de confort de jeu

Audit en 7 angles (déroulé d'une run, combat, inventaire, menus, clarté, et deux parties jouées pour
de vrai, sur mobile et sur PC) : 103 constats, 26 corrections retenues, chacune relue puis vérifiée
dans le navigateur.

**Run et carte**

- **Rejouer en 1 appui** depuis l'écran de fin : « ↻ Rejouer (mêmes héros) » ou « Autre équipe ».
  Le jeu retient le dernier départ (monde, difficulté, héros) : l'accueil et le choix d'équipe le
  reprennent. Une 3e classe choisie remplace la plus ancienne. En cas de victoire, le récap dit ce qui
  vient d'être débloqué.
- **Moins d'écrans « Continuer »** : soin, recrue, philtre, prière, idole, clé achetée et zaap
  s'annoncent par un bandeau non bloquant (en bas de l'écran sur téléphone) et on enchaîne.
- **Fin de combat lisible** : un court voile « Victoire ! » / « Défaite… » avec le résultat du défi,
  puis le bilan (XP, kamas, niveaux) en tête du butin.
- **Butin** : « ⚡ Équiper » est dans la barre du bas (plus caché sous la liste) ; chaque objet équipé
  indique « ✓ sur Iop ». Le butin du donjon secret et des coffres a les mêmes aides.
- **Taverne et rencontres** : les PV de l'équipe sont affichés ; le soin est chiffré (« +86 PV, relève
  Cra ») ou signale « équipe déjà en pleine forme » ; la recrue indique son niveau d'arrivée et, au
  remplacement, chaque héros montre niveau et PV.
- **Carte** : titre « Zone 4/12 · Nom » avec le Tier des objets, héros K.O. bien visibles (tavernes
  en surbrillance), barre d'XP. Le contenu de chaque case est lisible : monstres du combat, boss du
  donjon, affixe du combat dur (au survol sur PC ; sur téléphone, un premier appui montre le contenu,
  un second y va).
- **Carte au clavier** : touches 1 à 9 pour les cases (AZERTY compris), E/S/F/B pour Équipement,
  Stats, Formation, Bestiaire ; molette et glisser pour faire défiler.
- Le philtre d'Otomai s'arrête de vous être proposé à 4/4 ; la Formation ne réinitialise plus les
  préréglages des autres classes.

**Combat**

- On voit **qui joue** pendant les tours des monstres (carte et frise en surbrillance, « Ronde N »,
  pastilles déjà jouées atténuées).
- **Sorts indisponibles** : la vraie raison (« PA », « 1/1 », « 1er tour », « Aucune cible »…) est
  écrite sur l'icône et s'affiche au toucher.
- **États chiffrés** : « ☠ poison 12/t · 3 t », « 🛡 bouclier 40 · 2 t », « ⚔ +15 % dgts »… avec
  l'explication au toucher.
- **Ciblage au clavier** : ←/→ ou Tab pour choisir la cible, Entrée (ou la touche du sort) pour
  lancer ; une cible mortelle est proposée en premier. Clic droit pour annuler.
- Sur téléphone : journal compact dépliable d'un appui, sorts mieux espacés, objectifs de succès
  repliés en pastille 🏆 qui se replie au premier geste.

**Inventaire, HDV, Forgemagie**

- Les objets « mitigés » disent s'ils sont **plutôt mieux ou plutôt moins** bien ; « Vendre
  l'inutile » s'appuie sur ce calcul.
- **HDV** : achat annulable, bouton « Équiper sur <héros> » juste après un achat, annulation des
  ventes groupées ; plus de débordement sur téléphone, prix toujours visible (« il manque X k »).
- **Forgemagie** : pièces portées d'abord (par héros), aperçu du seul gain du palier suivant,
  résultat affiché là où l'on regarde.
- Équipement : le filtre ne bloque plus sur un emplacement vide, le double-clic équipe vraiment sur
  PC, « Bonus total » affiche les bons signes et « +1 PA (max +2) ».

**Menus et clarté**

- **Entrée** valide l'action principale de chaque écran ; chaque nouvel écran repart en haut.
- **Infobulles au toucher et au clavier** partout (plus d'aide cachée dans des survols).
- Accueil : monde et difficulté retenus, étoiles plus faciles à toucher, rappel « Monde 2 · ★★
  Difficile » sous Jouer. L'encart Dofus ouvre directement le bon Dofus dans les Succès.
- **Sauvegarde plus sûre** : avant d'écraser la partie (import ou récupération en ligne), un résumé
  des deux parties (Dofus, quêtes, archis, run en cours) et une copie de secours restaurable.
- Règles mises à jour (8 emplacements, Dofus sans ordre imposé, PA plafonnés, Tier expliqué).

## Passe de conformité : Dofus libres, défis en direct, confort

**Dofus.** Chaque Dofus s'obtient **dès que son succès est terminé**, sans attendre ceux de niveau
inférieur. Vérification complète : chaque Dofus est rangé dans le monde de sa tranche de niveau réelle
(1-50 → Monde 1, 51-100 → Monde 2, 101-150 → Monde 3, 151-199 → Monde 4, 200 → Monde 5) et ses
quêtes se font au plus tard dans ce monde (test automatique). Corrigés : Dofus Ocre et Argenté
Scintillant (niveau 200) passent au Monde 5 ; l'Argenté Scintillant demande aussi de gagner le
Monde 4. Les Dofus mis de côté par l'ancien ordre strict sont rendus avec leur jet au lancement.
L'accueil montre les **Dofus à portée** : les deux succès de Dofus les plus avancés.

**Défi et objectifs suivis en direct pendant le combat.**

- Le défi affiche son état : en cours (avec « ronde 2/4 » pour Blitzkrieg), ✔ réussi si tu gagnes,
  ou ✖ raté (grisé) dès qu'il ne peut plus réussir.
- Les objectifs de succès aussi : ✔ quand le boss demandé tombe, ✖ si un héros tombe pour un
  « sans KO », et les compteurs avancent en direct (« Vaincre 25 monstres : 12/25 », dégâts d'un
  élément, soins). La pastille 🏆 compte les objectifs validés.
- Sur grand écran, le panneau des objectifs s'ouvre en bas à gauche (il ne cache plus le défi ni les
  ennemis).

**Équilibrage vérifié.**

- Audit de tous les objets (2 600 paliers de rareté) : puissance médiane exactement à la cible de
  leur Tier, progression régulière d'une zone à l'autre.
- Les objets à **+1 PA** (Gelano, Abracape, Bandeau de Spiritueur, Masque de Koutoulou…) donnaient
  le PA en plus de stats complètes : ils gardent le PA mais ont des stats réduites, et le PA n'existe
  plus qu'en épique et légendaire.
- Simulation de 24 runs par monde avec le joueur automatique : victoires Monde 1 42 %, Monde 2 38 %,
  Monde 3 42 %, Monde 4 50 %, Monde 5 21 % (il tombait à 8 % : ses monstres sont adoucis de 5 %, et
  davantage dans les zones à pic de morts). Pics restants adoucis ensuite sans nouvelle simulation :
  Tanière du Meulou (−12 %) et Breuil du Vénérable (−8 %).

**Confort.**

- **⚡ Équiper le meilleur** (écran Équipement) : met sur chaque héros les objets qui sont une nette
  amélioration. Aussi sur l'écran de butin : **Équiper les améliorations**, et chaque objet trouvé
  montre à quel héros il sert.
- **Vendre l'inutile** à l'hôtel de vente : vend d'un coup les objets qui n'améliorent aucun héros.
- **⏩** à côté de « Fin du tour » : tours des monstres rapides, sans passer par les Paramètres.

## Sauvegarde en ligne (PC ↔ mobile)

Dans l'artefact claude.ai, **Paramètres → ☁️ Sauvegarde en ligne** : la partie (Dofus, succès,
réglages et run en cours) est rangée à un emplacement privé lié à ton compte claude.ai. Ouvre le même
artefact sur PC ou sur mobile, connecté au même compte : pas d'identifiant ni de mot de passe à créer.

- **Envoyer cette partie** / **Récupérer** (avec confirmation, chacun remplace l'autre côté).
- **Auto** (activé par défaut) : la partie s'envoie toute seule quelques secondes après chaque
  sauvegarde (fin de combat, de zone…). Elle n'écrase jamais une partie plus récente envoyée depuis
  l'autre appareil : l'accueil affiche alors « Une partie plus récente est en ligne » avec
  **Récupérer** ou **Garder celle d'ici**.
- La sauvegarde est découpée en morceaux (limite de taille de la base) et vérifiée avant import.
- Hors de l'artefact (version locale), la section n'apparaît pas ; l'export en fichier ou en texte
  reste disponible partout.

## Dofus débloqués, archimonstres moins répétitifs, nouvel habillage

**Bug des Dofus corrigé.** La Couronne du Wa Wabbit, demandée par le Dofus Cawotte (niv. 80), ne
tombait plus depuis la refonte des panoplies. Comme les Dofus s'obtiennent dans l'ordre, tous ceux
de niveau 80 et plus étaient bloqués. Elle retombe au Terrier du Wa Wabbit ; un nouveau test vérifie
que **chaque quête de succès est faisable** (boss rencontrés, zones, objets qui tombent, reliques).

**Prochain Dofus sur l'accueil.** Un encart montre le Dofus suivant dans l'ordre, ses quêtes (faites
ou non, avec compteur) et les Dofus « en attente » ; il ouvre l'écran Succès.

**Archimonstres.** Avant, compléter les archis d'un monde demandait des centaines de runs (estimation
par simulation : 200 à 400). Désormais :

- un archimonstre **jamais capturé** apparaît **5 fois plus souvent** ;
- la **jauge de traque** : chaque combat qui pouvait en contenir un sans en faire apparaître
  augmente de 2 % la chance d'un archi inédit (jusqu'à +40 %). Elle se garde d'une run à l'autre
  et se vide quand un archi inédit apparaît ; elle est affichée dans le Bestiaire ;
- l'avis de recherche (case Rencontre) vise d'abord un archi qui te manque.

Il faut encore plusieurs runs par monde (de l'ordre de 20 à 40 pour tout capturer), c'est voulu :
le Dofus Ocre et le Dokille restent des objectifs de fin de jeu.

**Nouvel habillage.**

- Écrans en parchemin chaud et opaque, double cadre brun et doré (fini l'aspect gris délavé
  sur les décors) ; titres bruns avec filets dorés ; boutons orange en relief.
- Carte : plateau parchemin, cases atteignables et donjons mis en valeur, cases visitées estompées.
- Combat : vrai bouton « Fin du tour » (texte lisible), combattant actif bien cerné.
- Accueil : légende sous chaque icône du menu ; mentions et crédits sortis de la barre du bas
  (le bouton Jouer prend moins de place sur téléphone).
- Bandeaux de quête et fiches d'objet au même style.

## 8 emplacements d'équipement et vraies panoplies de Dofus

**Huit emplacements, comme dans Dofus** : arme, coiffe, cape, **amulette**, **deux anneaux**,
**ceinture** et **bottes**.

- Un anneau va dans l'emplacement libre, sinon à la place du moins utile ; la fiche propose aussi
  « À la place de … » pour choisir l'autre anneau, et on peut le déposer sur l'emplacement voulu.
- Comme dans Dofus, deux anneaux identiques d'une même panoplie ne se portent pas ensemble.
- L'écran Équipement montre les 8 emplacements en grille compacte (icône, emplacement, Tier) : tout
  tient sans défiler sur téléphone. Un ▲ vert signale un emplacement qu'un objet de l'inventaire
  améliorerait. Touche un emplacement pour la fiche détaillée.
- Plus de butin pour remplir tout ça : jusqu'à 6 tirages par victoire (4 avant), et 7 objets à
  l'hôtel de vente (5 avant).

**Les panoplies sont celles du vrai jeu.** 173 panoplies reprises de Dofus (données DofusDB) :

- **Toutes leurs pièces** (Panoplie du Bouftou : marteau, coiffe, cape, amulette, anneau, ceinture,
  bottes…) et leur nom réel.
- **La bonne famille de monstres** : chaque panoplie tombe dans la zone des monstres qui lâchent ses
  pièces ou ses ressources de craft — Bouftous et Bouftou Royal à Tainéla, Tofus au donjon des Tofus,
  Scarafeuilles, Larves, Kwaks, Blops, Gelées, Wabbits, Craqueleurs, Mulous, Rats de Bonta et
  Brâkmar, Corbacs, Dragoeufs, Minotoror et Mominotor au Labyrinthe, Givrefoux, Bworks, Gloursons,
  Harebourg, Wukin et Wukang…
- **Le bon niveau** : une panoplie reste dans la tranche de niveaux de son monde (niveau Dofus affiché
  dans l'Armurerie), au plus près de sa zone. Les pièces lâchées par le boss restent au butin du boss.
- **Les bonus par palier suivent ceux du jeu**, de 2 pièces à la panoplie complète (jusqu'à 7) : même
  forme (élément, vitalité, résistances, critique, soins…) et **+1 PA au palier où Dofus en donne**
  (souvent 3 pièces). Les PA de panoplie ne se cumulent pas (+1 au plus) et l'équipement donne +2 PA
  au maximum.
- Les objets uniques à effet spécial (Kwakwanneau, Abracape…) sont gardés. Une zone sans pièce pour un
  emplacement reçoit un objet réel lâché par ses monstres.
- Les panoplies des donjons secrets (en Mousse, Boufcoul, Professeur Xa, Kolosso, Tal Kasha) ont
  aussi toutes leurs pièces.
- La puissance d'un objet dépend toujours de son Tier (toile), de sa rareté et de sa source ; chaque
  emplacement a son poids, et 8 objets complets valent un peu plus que les 4 d'avant.
- L'Armurerie liste toutes les panoplies d'une zone, avec où elles tombent (combats, combats durs,
  boss) et leur niveau dans Dofus.

**Anciennes sauvegardes** : les objets équipés restent en place (l'ancien anneau devient l'anneau 1).
Les quelques pièces d'anciennes panoplies qui n'existent plus restent dans l'inventaire (sans bonus de
panoplie) et gardent leur Tier.

Les icônes d'objets sont compressées (même rendu, 4 fois plus légères).

**Équilibrage vérifié par simulation** (24 runs par monde, joueur automatique) : victoires Monde 1
42 %, Monde 2 29 %, Monde 3 42 % (71 % avant d'avoir renforcé ses monstres de 7 %), Monde 4 33 %
(puis monstres −3 %), Monde 5 25 %. Les héros remplissent leurs 8 emplacements vers la 4e zone.

## Ordre des Dofus, refonte du combat et de l'inventaire, chasse aux bugs

**Les Dofus s'obtiennent dans l'ordre de Dofus 3.** Chaque Dofus a son vrai niveau de succès dans
Dofus 3 (Argenté 40, Cawotte 80, Dokoko 100, Émeraude 120, Pourpre 130, Domakuro 140, Dorigami 170,
Turquoise 180, et les Dofus de niveau 200 : Glaces, Abyssal, Veilleurs, Ivoire, Ébène, Tacheté,
Forgelave, Nébuleux, Vulbis, Sylvestre, Verdoyant, Cauchemar, Dolmanax, Dokille, Dofoozbz…).

- Un Dofus ne s'obtient qu'une fois possédés **tous les Dofus de niveau inférieur**. Si ses quêtes sont
  finies avant, il est « en attente » et arrive tout seul dès que ses prérequis sont réunis.
- Dolmanax, Dokille et Dofoozbz, de niveau 200 dans Dofus 3, passent au Monde 5 (Dolmanax : une
  année d'offrandes, 50 runs ; Dokille : 100 âmes d'archimonstres ; Dofoozbz : gagner le Monde 4).
- Anciennes sauvegardes : un Dofus obtenu avant ses prérequis est mis de côté, avec son jet, et revient
  quand l'ordre est respecté. Un message l'explique au premier lancement.
- L'écran Succès montre l'état « En attente » et les Dofus qui manquent avant chacun.

**Combat plus lisible.**

- Même carte pour les héros et les monstres : portrait, nom, grande barre de PV, PA du combattant qui
  joue, états. Les statistiques secondaires (critique, soins…) ne s'affichent plus sur les cartes.
- Seules les résistances non nulles sont affichées (vert = résiste, rouge = faiblesse), plus l'élément
  que ton héros va frapper.
- Quand un sort est choisi, chaque cible affiche les **dégâts prévus** (« 💥 21–33 dégâts », « ☠ » si
  le coup peut l'achever) ; les cartes qu'on ne peut pas viser s'effacent un peu.
- L'ordre de jeu est au-dessus du plateau ; l'infobulle du sort choisi ne cache plus les cibles ; sur
  téléphone, les détails du sort se déplient avec ⓘ.

**Inventaire plus lisible.** Chaque objet : son nom et le verdict (Amélioration…), puis « **T13** ·
Arme · Épique » (le Tier en évidence), ses statistiques, et la comparaison avec l'objet porté sur une
ligne à part. Les objets portés ont le même style. Le Tier s'affiche aussi à l'hôtel de vente, au
butin et chez le forgemage. Sur téléphone, la liste suit la page (plus de défilement dans le
défilement). Une stat inutile pour la classe est marquée « (inutile) » au lieu d'être barrée.

**Bugs corrigés** (relevés par un audit complet du code) :

- Combat : les protections d'un tour des boss (Tête dans le sable, Furie du Kimbo…) expiraient avant
  le tour adverse ; les monstres soigneurs ignoraient le rechargement de leur soin ; une riposte
  ignorait le Dokille et les protections ; la Lance du Forgelance était visée par les créatures et
  masquait la ligne arrière ; un bouclier temporaire expiré retirait du bouclier déjà consommé ; un
  désenvoûtement retirait pour de bon les bonus d'état du Pandawa et du Zobal ; le renfort des
  difficultés n'était pas à la puissance de la zone.
- Jeu : perdre le donjon secret ressuscitait les héros morts en mode mort définitive ; une traque
  ajoutait +20 % de PV à des combats sans archimonstre (et au donjon secret) ; en Ultime, les tavernes
  restaient utilisables équipe complète ; l'aide annonçait un mauvais taux de butin en combat dur.
- Interface : Échap sur une fiche d'objet quittait tout l'écran d'équipement ; la saisie de la touche
  de fin de tour acceptait Échap et les chiffres des sorts (et restait active en quittant) ; une touche
  maintenue pouvait finir plusieurs tours ; l'hôtel de vente et la forgemagie remontaient en haut de
  la liste après chaque action ; les boutons de sauvegarde débordaient sur téléphone ; numéros des
  sorts illisibles.
- Sécurité : une sauvegarde importée est nettoyée (statistiques et raretés connues seulement), pour
  qu'un fichier piégé ne puisse pas injecter de code.

## Tier des objets

- Le tri « Toile » de l'inventaire devient « Tier » : les objets du Tier le plus haut d'abord (puis
  les plus rares).
- Le Tier (« T13 ») s'affiche aussi sur les objets portés et dans la fiche d'objet, à gauche de
  l'emplacement, comme dans l'inventaire.

## Export de la sauvegarde sur claude.ai

- Sur la page claude.ai, « Exporter » passe par le téléchargement de claude.ai (tu confirmes
  l'enregistrement) : l'ancien lien de téléchargement y était bloqué.
- Nouveau bouton « Texte… » : la sauvegarde s'affiche en texte à copier (ou est copiée d'un clic), et
  on peut la recoller pour l'importer. Ça marche partout, même là où les fichiers sont bloqués.

## Donjons secrets, panoplies et équilibrage

**Donjons secrets.** Chaque monde cache un vrai donjon optionnel de DOFUS : le Château Ensablé (Mob
l'Éponge et ses Pichons), la Caverne du Koulosse, le Repaire de Skeunk et ses quatre gardiennes, les
Cavernes du Kolosso (Kolosso et Professeur Xa) et la Chambre de Tal Kasha. Monstres, sorts des boss et
butin viennent de DofusDB.

- La clé se trouve dans un coffre abandonné, chez un contrebandier (nouvelle rencontre, à acheter ou à
  jouer aux dés) ou sur un monstre de combat dur. Elle s'affiche sous le titre de la carte.
- Après le boss d'une zone, on choisit d'entrer ou de garder la clé. Le donjon secret est plus fort que
  celui de la zone, et grandit avec elle ; la récompense aussi.
- Victoire : un objet épique ou légendaire de son butin (Panoplie en Mousse, du Boufcoul, du
  Professeur Xa, de Tal Kasha, trophées de Skeunk), 3 fois les kamas d'un donjon et beaucoup d'XP.
  Défaite : l'équipe est expulsée et la clé perdue, mais la run continue.
- Nouveau succès « Donjons secrets » ; les donjons secrets ont leur page dans le bestiaire et
  l'armurerie.

**Panoplies.** Le bonus ne venait qu'avec 4 pièces (+1 PA), alors que 56 panoplies sur 88 n'avaient que
2 ou 3 pièces : leur bonus était impossible à obtenir. Les bonus vont maintenant par palier :

- 2 pièces, puis 3 pièces : caractéristiques élémentaires et vitalité, à la mesure du niveau de la zone ;
- 4 pièces : +1 PA en plus ;
- une petite panoplie complète (2 ou 3 pièces) donne aussi des résistances.

L'écran d'équipement montre le palier atteint et le suivant ; l'armurerie et les infobulles détaillent
tous les paliers. Quatre « panoplies » dont les pièces allaient toutes sur le même emplacement (deux
anneaux, deux armes) ne pouvaient jamais s'activer : leurs objets redeviennent des objets simples.

**Objets.** À rareté égale, la puissance d'un objet variait d'un facteur 10 à 30 selon la zone (une pièce
épique valait de 1 % à 37 % de puissance pour un héros du bon niveau). Toutes les statistiques sont
recalées sur une même courbe selon la rareté, la source (combat, élite, boss) et l'emplacement ; les
pièces de panoplie sont un peu en dessous, puisque leur bonus compense.

**Équilibrage global**, mesuré par simulation de runs complètes (voir `outils/simulation`) :

- La première zone de chaque monde était le vrai mur (60 à 90 % des défaites, avec deux héros sans
  équipement), puis la suite devenait facile. Désormais la rangée qui suit le premier combat d'un monde
  est faite de tavernes, et les héros debout récupèrent 10 % de leurs PV max après chaque victoire.
- La puissance des monstres est réglée zone par zone (`src/data/ajustementsZones.json`) pour une
  difficulté qui monte régulièrement jusqu'au dernier boss : les débuts sont plus doux, les fins de
  monde plus exigeantes, et les murs isolés (Terrier du Wa Wabbit, Dojo du Vent, Cavaliers de
  l'Eliocalypse) sont aplanis.
- L'XP des Mondes 3 et 4 allait trop vite (niveau maximum dès la zone 6 ou 7) : elle monte maintenant
  régulièrement jusqu'à la dernière zone.
- Les bandeaux de quêtes et de défis sont plus compacts (3 au plus à l'écran).

**Ergonomie sur téléphone** : chaque écran de jeu tient (presque) sans défiler.

- **Carte** : la vue suit la progression. Elle se centre sur la case actuelle et les cases atteignables,
  au lieu de revenir au départ de la zone après chaque combat. La barre d'outils tient sur une rangée,
  la carte s'adapte à la hauteur de l'écran, et l'équipe reste visible en bas.
- **Combat** : lignes avant et arrière côte à côte, cartes compactes (les PA ne s'affichent que pour
  le combattant qui joue), bandeau du défi sur une ligne, journal réduit. Les sorts tiennent sur une
  rangée avec « Terminer » juste dessous, le tout collé en bas de l'écran. Quand on choisit un sort,
  l'écran défile jusqu'aux cibles si elles sont cachées. Sur un iPhone 13, tout le combat tient dans
  l'écran.
- **Équipement** : les héros en onglets sur une rangée, les colonnes ne débordent plus ; toucher un
  emplacement vide filtre l'inventaire sur cet emplacement et y descend.
- **Rencontres et autres écrans** : illustration et choix plus compacts, et le bouton Retour ou
  Continuer reste visible en bas.

## Sorts colorés, défis et rencontres

**Icônes de sorts par élément.** Chaque sort de dégâts est teinté de la couleur de l'élément qu'il
frappe (Terre marron, Feu rouge, Eau bleu, Air vert), avec une pastille d'élément dans le
coin. Pour un sort qui suit le meilleur élément du héros, la teinte suit ses caractéristiques du moment ;
dans l'encyclopédie, les sorts des classes bi-élément sont teintés des deux couleurs. L'infobulle
précise l'élément frappé.

**Défis de combat.** Comme dans DOFUS, chaque combat tire un défi, affiché en haut de l'écran.
Le réussir donne +30 % d'XP et de kamas (et une bourse en plus pour un donjon). Les défis sont Premier,
Dernier (la cible est marquée 🎯), Blitzkrieg, Survivant, Abnégation (seulement si l'équipe peut se
soigner) et Élémentaire (seulement si les héros ont un élément en commun).

**Case « Rencontre »** sur la carte, avec cinq événements :

- **Sanctuaire des Douze** : prier un dieu parmi trois pour une bénédiction qui dure toute la run
  (Iop +8 % de dégâts, Sacrieur +10 % de PV, Feca +6 % de résistances, Enutrof kamas et prospection,
  Ecaflip critique, Eniripsa soins, Xélor initiative, Sram esquive), ou se recueillir pour soigner 30 %.
- **Coffre abandonné** : l'ouvrir (un tiers de chance de piège), le crocheter sans risque avec un Sram,
  un Roublard ou un Ecaflip, ou passer son chemin. Il contient des kamas et parfois un objet de la zone.
- **Marchand ambulant** : potion de soin, parchemin d'expérience ou philtre d'Otomaï (plus
  d'archimonstres).
- **Autel des Idoles** : des monstres plus forts jusqu'à la fin de la zone, en échange de plus d'XP, de
  kamas ou de prospection.
- **Avis de recherche** : traquer un archimonstre de la zone, ou accepter une prime (le prochain combat
  rapporte le double de kamas).

Les effets en cours (bénédictions, idole, traque) s'affichent sous le titre de la carte.

## Progression linéaire des Dofus (lore de Dofus 3)

Les 31 Dofus se gagnent maintenant au fil des mondes, selon leur niveau d'obtention réel dans Dofus 3
(le niveau du succès qui les donne), et leurs quêtes suivent le lore :

- **Monde 1** : Dofawa, Dofus Argenté (« D'Incarnam à Astrub »), Jyfus, Dofus Cacao (le nid du Kwakwa).
- **Monde 2** : Dofus Cawotte (« Poil de Cawotte » : Wa Wabbit, Wa Wobot et sa couronne), Dokoko
  (« Koko Boy » : Kanniboul Ebil, Chouque, Moon), Dofus Kaliptus, Dolmanax (« L'année du dragon »).
- **Monde 3** : Dofus Émeraude (« Vert émeraude », Draconanthropie avec Crocabulia), Dokille (« Trophée de
  chasse » : le safari des âmes), Dofus Pourpre (Rats, « Le livre des Taures » avec le Minotoror),
  Dotruche (la Haute Truche), Domakuro (Pandala).
- **Monde 4** : Dorigami (Yokai de Grobe), Dofus Turquoise, Dofus Ocre (les âmes des archimonstres),
  Dofoozbz (le Supervizœuf), Dom de Pin, Dofus Argenté Scintillant (les trophées de Rathrosk).
- **Monde 5** : Dofus des Glaces (« Œuf à la neige » : Frigost III jusqu'au Comte Harebourg), Abyssal
  (Sufokia), Veilleurs (Dimensions Divines), Ivoire, Ébène, Tacheté, Forgelave (Tours de la Fratrie),
  Nébuleux, Vulbis, Sylvestre, Verdoyant et Cauchemar (« Eliocalypse : Réminiscence »).

Pour que ce lore existe en jeu, quelques zones changent : la Volière de la Haute Truche (Monde 3), le
Poste de contrôle du Supervizœuf et la Demeure des esprits de Koumiho (Monde 4) ; le Monde 5 est
réorganisé autour de Frigost III, Sufokia, les Dimensions Divines, les Tours de la Fratrie, Wukin et
Wukang, Osavora et l'Eliocalypse.

- Chaque monde a aussi ses succès de donjons, défis Duo / Premier / Dernier / Blitzkrieg, reliques et
  conquête.
- L'écran Succès range les Dofus dans l'ordre où on les obtient, avec leur monde et leur niveau.
- La progression déjà faite est conservée pour les quêtes reprises (reliques des mondes 1 et 2,
  archimonstres du Dofus Ocre) ; les Dofus déjà obtenus restent acquis.

## Mondes 3, 4 et 5

Les trois derniers mondes sont jouables. Leurs boss sont répartis comme les succès « Donjons » de
Dofus 3 : niveaux 101 à 150 (Monde 3), 151 à 190 (Monde 4) et 191 à 200 (Monde 5). Monstres, sorts
des boss, panoplies, reliques et archimonstres viennent des données du jeu (DofusDB).

- **Monde 3 (niveaux 100-150)** : Rats de Bonta et Brâkmar, Maître Corbac, Rasboul, Blop Multicolore
  Royal, Tofu Royal, Crocabulia, Minotoror, Nagate, Dojo du Vent (Hanshi et Shihan), Tynrils,
  Mansot Royal, Ben le Ripate.
- **Monde 4 (niveaux 150-199)** : Kimbo, Obsidiantre, Minotot, Shogun Tofugawa, Tengu et Fuji
  Givrefoux, XLII, Korriandre, Kralamoure Géant, Bworker, Ougah, Glourséleste, Ombre.
- **Monde 5 (niveau 200)** : l'arc de Frigost III (Missiz Frizz, Sylargh, Klime, Nileza, puis le
  Comte Harebourg), Sufokia (Merkator, Capitaine Meno, Koutoulou, Dantinéa), puis l'Eliocalypse :
  Corruption, Guerre, Servitude, Misère, et les quatre Cavaliers réunis pour le dernier combat.
- 243 monstres, 288 équipements (panoplies des donjons), 42 reliques, des archimonstres dans les
  mondes 3 et 4. Chaque boss a une attaque signature tirée de ses vrais sorts.
- Difficulté réglée par simulation pour suivre la courbe du Monde 2.
- **Succès** rangés par monde, comme dans Dofus 3 : un succès par donjon, les défis **Duo**
  (2 héros au plus), **Premier**, **Dernier** et **Blitzkrieg**, les reliques, les archimonstres et
  la conquête de chaque monde (jusqu'en Cauchemar).

## Inventaire et lisibilité

### Inventaire (écran Équipement)

- Toucher un objet ouvre sa **fiche** : tout ce qu'il donne, où le trouver, et pour **chaque héros**
  ce qu'il changerait (verdict ▲ Amélioration / ▼ Moins bien / ⇅ Gains et pertes) avec un bouton
  « Équiper » : on peut équiper n'importe quel héros sans changer d'onglet.
- Un équipement porté s'ouvre aussi en fiche, avec « Retirer » (fini les retraits par erreur au toucher).
- Filtres par emplacement (Arme, Coiffe, Cape, Anneau) et tri par toile, type, rareté ou **intérêt**
  (les améliorations d'abord).
- Les objets identiques sont regroupés (×2, ×3…).
- Les onglets des héros indiquent les emplacements remplis et le nombre d'améliorations disponibles.
- Sur ordinateur : double-clic pour équiper directement, glisser-déposer toujours possible.

### Hôtel de vente

- Pastilles « ▲ Iop » sur les objets à vendre ou à acheter qui amélioreraient un héros.
- Doublons regroupés dans l'inventaire, et la **dernière vente peut être annulée**.

### Lisibilité

- Tous les petits textes de l'interface d'origine ont été agrandis (plus rien sous 11 px).
- Carte : le nom des cases atteignables est toujours affiché, et chaque icône de la barre d'outils
  a sa légende (Stats, Formation, Équipement…).
- Combat sur téléphone : cartes plus compactes (résistances à côté du portrait).

## Lisibilité mobile, objectifs de combat et aides

### Objectifs de succès en combat

- Au début d'un combat, une fenêtre « 🏆 Objectifs dans ce combat » (façon suivi de succès de DOFUS)
  liste ce qu'on peut y gagner : quêtes de Dofus en jeu (boss présent, combat dur, donjon de fin de
  zone, dernier donjon du monde) avec la consigne exacte (« aucun héros ne doit tomber », « gagne en
  2 rondes au plus »…), reliques possibles avec leur chance, archimonstres à capturer.
- Elle se replie toute seule en bouton 🏆, qu'on touche pour la rouvrir.

### Quêtes et succès

- Chaque quête non faite affiche un indice : où trouver le boss (zone, monde, type de case),
  quelles classes font avancer un compteur, quelle difficulté choisir, quelles règles respecter.
- Sur téléphone, choisir un Dofus fait défiler jusqu'à ses quêtes.

### Caractéristiques

- Chaque caractéristique montre ce qu'elle apporte vraiment (« Dégâts Feu +36 % », « Critique 8 % »,
  « +12 Prospection »…) et signale un élément que la classe n'utilise pas.
- Nouveau bloc « En combat » : PA, initiative, critique, dégâts critiques, esquive, soins,
  prospection et résistances, Dofus compris. Chaque valeur a son aide.

### Équipement

- Noms complets des caractéristiques (Force, Intelligence… au lieu de For, Int…), avec leur effet
  au survol.
- Les stats adaptatives sont résolues pour le héros (« +12 Force ★ +12 Chance ★ » sur un Feca).
- L'attaque d'arme est expliquée (« Attaque d'arme : 14–18 dégâts, 4 PA »).
- Dans l'inventaire, chaque objet indique ce qu'il change par rapport à l'objet porté
  (« Si équipé (au lieu de Coiffe Bouftou) : +12 PV max −4 Agilité »).

### Mobile

- Cartes de combat horizontales sur téléphone : portrait, barre de PV, PA et résistances lisibles.
- Tailles de texte minimales relevées partout (étiquettes, puces, indices).
- Sur écran tactile, toucher un élément à infobulle (objet, Dofus, stat) ouvre son aide.

## Nouvelles classes, Dofus et aides

### 8 classes jouables en plus (19 au total)

Chaque classe a 6 sorts tirés de DOFUS et une mécanique propre :

- **Sadida** (réactivé, refait) : infecte ses cibles ; Contagion se propage aux infectés, Inoculation
  grossit avec leur nombre ; La Bloqueuse provoque les ennemis.
- **Osamodas** : invoque Tofu, Bouftou (qui provoque) et Crapipou, qui jouent seuls ; Fouet les excite,
  Piqûre Motivante leur donne des PA.
- **Enutrof** : Force de l'Âge grandit à chaque tour ; Pelle Fantomatique désenvoûte ; Sac Animé ;
  passif : +25 % de kamas et prospection élevée.
- **Sacrieur** : Souffrance (jusqu'à +60 % de dégâts à bas PV), vol de vie, Mutilation, Transfusion,
  Sacrifice.
- **Pandawa** : Sobre ou Saoul (Bombance) ; ses sorts changent selon son état.
- **Zobal** : trois masques (Intrépide, Psychopathe, Pleutre) qui renforcent chacun un sort.
- **Steamer** : tourelles Harponneuse et Gardienne qui jouent seules, Évolution, Scaphandre.
- **Huppermage** : marques Feu et Eau ; mélanger les deux déclenche une combinaison élémentaire,
  Polarité consomme les marques.

Équilibrage vérifié par simulation : les nouvelles classes ont des taux de victoire dans la
fourchette des classes d'origine.

### Dofus

- Les 12 Dofus « effet à venir » ont maintenant un effet (Vulbis, Abyssal, Cawotte, Sylvestre,
  Verdoyant, Cacao, Forgelave, Dofoozbz, Dokille, Dom de Pin, Dotruche, Jyfus).
- **27 Dofus étaient impossibles à obtenir** (seuls 4 avaient un succès) : chacun a maintenant son
  succès (vaincre des boss, terminer des zones, gagner un monde sous condition, cumuler des dégâts
  ou des soins…).

### Aides

- Survoler un objet (équipement, HDV, butin, armurerie, forgemage) indique où il tombe.
- L'infobulle d'un Dofus indique le succès et les quêtes qui le donnent.
- Nouvelle section des règles « Obtenir équipement, Dofus et reliques », avec les vrais taux.

### Corrections

- La poupée du Sadida apparaissait sur la case d'un héros (position 0) ; elle prend désormais une
  case libre.
- Plateau de combat : les cartes passent à la ligne quand un camp a beaucoup d'invocations, au lieu
  de pousser l'autre camp hors de l'écran.

### Crédits

- Portraits (encyclopédie officielle dofus.com), symboles de classe et icônes de sorts
  (DofusDB) © Ankama Games ; bandeau de crédits sur l'accueil et dans les mentions légales.

## Corrections et améliorations (passe complète)

### Bugs corrigés

- **Plantage avec une arme équipée** (introduit par la reconstruction du code) : le jeu plantait dès
  qu'un héros portait une arme ou des pièces de panoplie. Trouvé par le test de fuzz.
- **Tour sauté à tort** : quand un héros n'avait plus assez de PA que pour son attaque d'arme, le
  « passage automatique du tour » le considérait sans action possible et sautait son tour.
- **Tour du héros suivant écourté** : si le joueur appuyait sur « Terminer » pendant le passage
  automatique d'un tour, le délai restant pouvait ensuite terminer le tour du héros suivant.
- **Raccourcis clavier** : les touches 1 à 9 permettaient de sélectionner un sort en recharge ou
  sans cible (sélection bloquée) ; ils suivent maintenant les mêmes règles que les boutons. Le
  bouton d'arme est aussi grisé quand l'arme n'a aucune cible.
- **PV au-dessus du maximum après une forgemagie** qui baisse la Vitalité d'un objet équipé.
- **Équipement perdu au rechargement** : les changements d'équipement ou de formation faits depuis
  la carte n'étaient sauvegardés qu'au nœud suivant.
- **Textes** : l'aide des caractéristiques affichait des notes de développement
  (« voir VITA_PAR_FORCE, progression.ts ») ; l'indication « seuls les 2 premiers ennemis sont à
  portée » était fausse dès 3 ennemis en ligne avant.

### Sécurité contre les fausses manipulations

- Confirmation avant **Recommencer** (carte), **Abandonner la run** (accueil) et **Vendre tout**
  (hôtel de vente) : un seul appui suffisait à perdre une run ou tout l'inventaire.

### Interface

- **Mobile** : les icônes de l'accueil ne chevauchent plus les boutons Règles/Discord ; la barre
  d'icônes de la carte reste lisible ; en combat, plateau sur une colonne (ennemis en haut),
  cartes compactes, ordre de jeu qui ne masque plus les sorts, barre de sorts toujours visible en
  bas de l'écran, plus de défilement horizontal caché.
- **Écrans tactiles** : un appui sur un sort affiche sa description ; les sorts sans cible à choisir
  se lancent avec un bouton « Lancer » (au lieu d'être lancés sans prévenir) ; un bouton
  « Annuler » remplace la touche Échap ; les raccourcis clavier ne sont plus affichés.
- **Sort sélectionné** : sa description complète s'affiche sous la barre de sorts ; un second clic
  sur le sort l'annule.
- **Nouveau réglage** « Tours des monstres rapides » (Paramètres).
- **Installable sur téléphone** (manifeste d'application, icônes) et aperçu de lien
  (Discord, réseaux) avec titre, description et image.

### Projet

- Tests automatiques (`npm test`) : cohérence des données et fuzz du moteur de combat.
