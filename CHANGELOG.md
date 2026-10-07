# Journal des modifications

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
