# Journal des modifications

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
