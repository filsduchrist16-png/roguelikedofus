import { afficherEcran, barreRetour, echapperHtml, racine } from "../commun.js";
import { AIDE_OBTENTION } from "../../jeu/obtention.js";
import { DIFFICULTES } from "../../jeu/config.js";
import { RELIQUES_RUN, SYNERGIES_RUN } from "../../data/index.js";
import { AMELIORATIONS_SORT } from "../../combat/ameliorations.js";
const SECTIONS_REGLES = [
  {
    titre: `La run`,
    corps: `<p>Une run se joue dans un monde, qui couvre une fourchette de niveaux. Chaque monde enchaîne plusieurs zones, et chaque
      zone est une carte qu'on traverse jusqu'au donjon. Battre le boss du donjon ouvre la
      zone suivante ; battre le dernier boss gagne la run.</p>
      <p>Tu pars avec deux héros et tu peux en recruter d'autres en taverne, jusqu'à quatre. Dans la
      première zone d'un monde, une taverne attend juste après le premier combat, quel qu'il soit.</p>`,
  },
  {
    titre: `Les PV`,
    corps: `<p>Après chaque combat gagné, les héros encore debout récupèrent 10 % de leurs PV max (rien en
      Ultime) ; un héros tombé reste K.O. Pour se soigner davantage, il y a la taverne (la moitié des PV max ; moins à partir d'Extrême,
      et en Ultime plus de taverne une fois l'équipe complète), certaines
      rencontres et la victoire contre un boss de zone, qui remet toute l'équipe sur pied.</p>
      <p>Si toute l'équipe tombe, la run s'arrête : tu perds les héros, l'équipement et les kamas.</p>`,
  },
  {
    titre: `La carte`,
    corps: `<ul>
      <li><b>Combat</b> : un groupe de monstres.</li>
      <li><b>Combat dur</b> : des ennemis renforcés (le bonus est affiché au survol, ou au toucher de la case), mais un meilleur butin.</li>
      <li><b>Taverne</b> : soin et recrutement.</li>
      <li><b>Otomaï</b> : augmente les chances de croiser des archimonstres pour le reste de la run.</li>
      <li><b>Zaap</b> : la rencontre n'est révélée qu'en arrivant.</li>
      <li><b>Hôtel de vente</b> : acheter et revendre des objets.</li>
      <li><b>Forgemagie</b> : faire monter un objet d'une rareté.</li>
      <li><b>Rencontre</b> : un événement à choix (sanctuaire, coffre, marchand, colporteur de reliques,
        autel de sang, idoles, avis de recherche, clé de donjon…).</li>
      <li><b>Camp de repos</b> (⛺) : au choix, se reposer (30 % des PV max) <i>ou</i> améliorer
        gratuitement un sort parmi trois proposés.</li>
      <li><b>Coffre</b> (🧰) : une relique de run ou un objet (rare au moins). Certains sont piégés : des
        monstres surgissent (combat, puis le trésor) ou des aiguilles blessent l'équipe (−20 % des PV
        max, coffre vide). Un Sram, un Roublard ou un Ecaflip debout le crochète sans risque.</li>
      <li><b>Donjon</b> : le boss de la zone.</li>
    </ul>
    <p><b>Choisir son chemin.</b> Depuis une case, les deux cases suivantes sont toujours de types
      différents : chaque étage est un vrai choix. Le chemin risqué paie : un <b>combat dur</b> donne
      toujours une relique de run dans son choix de récompense, des cartes plus rares, plus de butin, de
      kamas et d'XP. Chaque carte a au moins un combat dur, et un camp de repos juste avant le donjon.
      Touche une case (ou survole-la) pour lire ce qu'elle contient ; sur téléphone, un appui long
      sur une case atteignable y va directement.</p>
    <p><b>Donjon secret.</b> Chaque monde cache un donjon secret (Château Ensablé, Caverne du Koulosse,
      Repaire de Skeunk, Cavernes du Kolosso, Chambre de Tal Kasha). Sa clé se trouve dans un coffre,
      chez un contrebandier ou sur un monstre de combat dur. Après le boss d'une zone, tu peux l'utiliser :
      le donjon secret est plus fort que celui de la zone, et d'autant plus que la zone est avancée, mais
      il donne un objet épique ou légendaire de son butin, beaucoup de kamas et d'XP. Perdre n'arrête pas
      la run : l'équipe est expulsée et la clé est perdue.</p>`,
  },
  {
    titre: `Le combat`,
    corps: `<p>Les deux camps jouent chacun leur tour, en alternance. Chaque héros a ses PA à dépenser en
      sorts ou en attaque d'arme.</p>
      <p>Chaque camp a une ligne avant et une ligne arrière. La plupart des attaques ne peuvent viser que
      la ligne avant ; quand elle est vide, la ligne arrière est exposée. Tu choisis la place de tes héros
      dans l'écran Formation.</p>
      <p>L'élément de frappe est choisi tout seul : à chaque coup, le héros frappe dans celui de ses deux
      éléments que la cible résiste le moins.</p>`,
  },
  {
    titre: `Les caractéristiques`,
    corps: `<ul>
      <li><b>Force</b> (terre) : donne aussi de la vitalité.</li>
      <li><b>Intelligence</b> (feu) : augmente aussi tous les dégâts infligés.</li>
      <li><b>Agilité</b> (air) : chances et dégâts de coup critique, et esquive.</li>
      <li><b>Chance</b> (eau) : donne aussi de la prospection, qui fait tomber plus d'objets.</li>
    </ul>
    <p>Les caractéristiques montent toutes seules avec le niveau.</p>`,
  },
  {
    titre: `Équipement et kamas`,
    corps: `<p>Chaque héros a 8 emplacements, comme dans Dofus : arme, coiffe, cape, amulette, deux
      anneaux, ceinture et bottes. Les objets tombent en combat, en quatre raretés : commun, rare,
      épique et légendaire.</p>
      <p>Les panoplies sont celles du jeu : mêmes pièces, et chacune tombe dans la zone de sa famille de
      monstres (Bouftous à Tainéla, Tofus au donjon des Tofus, Minos au Labyrinthe…), à un niveau
      proche du sien. Porter plusieurs pièces d'une panoplie donne un bonus à chaque palier, jusqu'à la
      panoplie complète ; beaucoup donnent +1 PA à partir de 3 pièces, mais les PA de panoplie ne se
      cumulent pas (+1 au plus, et +2 PA au plus venant de tout l'équipement). Deux anneaux identiques
      d'une même panoplie ne se portent pas ensemble.</p>
      <p>Les kamas se gagnent en combat et en revendant des objets. Ils servent à l'hôtel de vente et à la
      Forgemagie.</p>`,
  },
  {
    titre: `Récompenses de combat`,
    corps: `<p>Après chaque combat normal ou dur gagné (pas après un boss, qui garde son butin), en plus
      du butin, choisis <b>une carte parmi trois</b>, ou passe contre quelques kamas. Les combats durs et
      les dernières zones d'un monde proposent plus souvent des cartes rares et épiques ; un combat dur
      propose toujours une relique de run (un combat normal, une fois sur cinq).</p>
      <ul>
        <li><b>Amélioration de sort</b> (⬆) : pour un héros et un sort, jusqu'à la fin de la run (deux au
          plus par sort). Le sort amélioré porte un ⬆ en combat, et son info détaille l'effet :
          <ul>${Object.values(AMELIORATIONS_SORT)
            .map(
              (def) =>
                `<li>${def.icone} <b>${echapperHtml(def.nom)}</b> : ${echapperHtml(def.texte({ type: `degats` }))}${def.nom === `Puissance` ? ` (ou de soins)` : ``}.</li>`,
            )
            .join(``)}</ul></li>
        <li><b>Relique de run</b> : un effet passif jusqu'à la fin de la run (${Object.keys(RELIQUES_RUN).length}
          reliques, une seule fois chacune), affiché sur la carte, dans l'équipement et dans le bilan. À ne
          pas confondre avec les reliques de boss, objets de collection gardés d'une run à l'autre.
          On en trouve aussi dans les coffres, chez le colporteur (une parmi trois, contre des kamas, prix
          selon la rareté), à l'autel de sang (une parmi deux, contre 8 % des PV max en combat pour toute
          la run, 40 % au plus) et au comptoir des tavernes (une seule, un peu plus chère).</li>
        <li><b>Bonus</b> : une bourse de kamas, un repos (35 % des PV max) ou un entraînement (des points
          dans les quatre caractéristiques élémentaires d'un héros, pour la run).</li>
      </ul>
      <p>Le choix proposé est sauvegardé : recharger la page montre les mêmes cartes.</p>`,
  },
  {
    titre: `Synergies de reliques`,
    corps: `<p>Certaines reliques de run se renforcent deux à deux. La description d'une relique annonce
      sa synergie ; une fois les deux reliques réunies, la synergie s'affiche (🔗) avec les reliques, sur la
      carte et dans l'équipement.</p>
      <ul>${Object.values(SYNERGIES_RUN)
        .map(
          (synergie) =>
            `<li>${synergie.icone} <b>${echapperHtml(synergie.nom)}</b> (${synergie.reliques.map((id) => echapperHtml(RELIQUES_RUN[id]?.nom ?? id)).join(` + `)}) : ${echapperHtml(synergie.desc)}</li>`,
        )
        .join(``)}</ul>`,
  },
  {
    titre: `Almanax du jour`,
    corps: `<p>Chaque jour (à minuit, heure de ton appareil), l'Almanax propose une petite quête, la même
      pour tout le monde : gagner des combats sans K.O., battre des combats durs ou un boss, toucher
      souvent dans un élément, ouvrir des coffres… Elle est affichée sur l'accueil et suivie pendant les
      runs (pas dans les Songes), avec une pastille 📅 sur la carte.</p>
      <p>Accomplie, elle met de côté une récompense modeste pour ta prochaine run (hors run du jour) :
      des kamas de départ ou une relique de run commune. Une nouvelle quête arrive le lendemain.</p>`,
  },
  {
    titre: `Ce qui reste après la mort`,
    corps: `<p>Les Dofus. Chacun donne un bonus permanent à toutes tes runs suivantes. On les obtient en
      terminant les groupes de quêtes du menu Succès.</p>
      <p>Restent aussi le bestiaire, l'armurerie, la progression des quêtes, les reliques et la jauge de traque
      des archimonstres.</p>
      <p><b>Reliques</b> : objets de collection comptés par les succès, sans bonus en combat.</p>`,
  },
  {
    titre: `Archimonstres`,
    corps: `<p>N'importe quel monstre peut apparaître en version archimonstre, plus forte. Le vaincre
      l'ajoute au bestiaire. Le Dofus Ocre demande de capturer tous les archimonstres des Mondes 1 à 4 et de gagner le Monde 5.</p>`,
  },
  {
    titre: `Obtenir équipement, Dofus et reliques`,
    corps: AIDE_OBTENTION,
  },
  {
    titre: `Glossaire`,
    corps: `<ul>
      <li><b>Tier (T)</b> : le « T13 » d'un objet est le numéro de la zone où il tombe, compté depuis le
        Monde 1 (les 12 zones du Monde 1 sont T1 à T12, puis le Monde 2 commence à T13…). Plus il est haut,
        plus l'objet est puissant.</li>
    </ul>`,
  },
  {
    titre: `Ascension`,
    corps: `<p>Les étoiles sur l'image d'un monde règlent sa difficulté, de une (normal) à cinq. Gagner une
      run débloque l'étoile suivante, et gagner un monde ouvre le monde suivant. Chaque palier garde les
      règles du précédent et en ajoute :</p>
      <ul>${DIFFICULTES.map((d) => `<li><b>${echapperHtml(d.nom)}</b> : ${echapperHtml(d.desc)}</li>`).join(``)}</ul>
      <p>Les monstres visent en priorité un héros qu'ils peuvent achever, puis les soigneurs et les héros
      fragiles. Sous 50 % de ses PV (60 % dès Extrême), un boss <b>entre en furie</b> : +20 % de dégâts et
      +1 PA jusqu'à la fin du combat (badge 💢 sur sa carte, 🔥 une fois en furie).</p>`,
  },
  {
    titre: `Songes infinis`,
    corps: `<p>Mode de fin de jeu, ouvert après une run du Monde 5 gagnée (bouton sur l'accueil). Tes deux
      héros partent au niveau 200 avec un objet commun du Monde 5 dans chaque emplacement, en difficulté
      Normal et sans idole.</p>
      <ul>
        <li>Une suite sans fin de combats (étages) de plus en plus durs, avec un boss tous les 5 étages.</li>
        <li>Tous les 3 étages, un <b>affixe de songe</b> s'ajoute pour de bon : il touche tous les ennemis
          des étages suivants (affiché en combat et entre les étages).</li>
        <li>Après chaque étage, choisis une récompense parmi trois : objet du Monde 5 (plus rare en montant),
          repos (50 % des PV, K.O. relevés à 30 %), kamas, bénédiction, amélioration de sort ou relique de
          run. Pas de soin automatique.</li>
        <li>Après chaque boss, un palier : équipe soignée à 100 %, une taverne et un Hôtel de vente.</li>
        <li>Quand toute l'équipe tombe, le score est le dernier étage franchi ; le record est gardé.</li>
      </ul>`,
  },
];
export function ecranRegles() {
  return new Promise((resolve) => {
    afficherEcran(`
      <h1>Règles</h1>
      <p class="regles-outils"><button type="button" id="regles-tout" class="secondaire petit">Tout déplier</button></p>
      <div class="regles">
        ${SECTIONS_REGLES.map((section, indice) => `<details class="regles-section"${indice === 0 ? ` open` : ``}><summary><h2>${section.titre}</h2></summary>${section.corps}</details>`).join(``)}
      </div>
      ${barreRetour(`retour`)}
    `);
    const sections = [...racine.querySelectorAll(`.regles-section`)];
    const bouton = racine.querySelector(`#regles-tout`);
    bouton?.addEventListener(`click`, () => {
      const deplier = sections.some((section) => !section.open);
      sections.forEach((section) => (section.open = deplier));
      bouton.textContent = deplier ? `Tout replier` : `Tout déplier`;
    });
    racine.querySelector(`#retour`)?.addEventListener(`click`, () => resolve());
  });
}
