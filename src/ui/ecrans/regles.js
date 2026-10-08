import { afficherEcran, barreRetour, racine } from "../commun.js";
import { AIDE_OBTENTION } from "../../jeu/obtention.js";
const SECTIONS_REGLES = [
  {
    titre: `La run`,
    corps: `<p>Une run se joue dans un monde, qui couvre une fourchette de niveaux. Chaque monde enchaîne plusieurs zones, et chaque
      zone est une carte qu'on traverse jusqu'au donjon. Battre le boss du donjon ouvre la
      zone suivante ; battre le dernier boss gagne la run.</p>
      <p>Tu pars avec deux héros et tu peux en recruter d'autres en taverne, jusqu'à quatre. Dans la
      première zone d'un monde, la rangée qui suit le premier combat est faite de tavernes.</p>`,
  },
  {
    titre: `Les PV`,
    corps: `<p>Après chaque combat gagné, les héros encore debout récupèrent 10 % de leurs PV max ; un héros
      tombé reste K.O. Pour se soigner davantage, il y a la taverne (la moitié des PV max), certaines
      rencontres et la victoire contre un boss de zone, qui remet toute l'équipe sur pied.</p>
      <p>Si toute l'équipe tombe, la run s'arrête : tu perds les héros, l'équipement et les kamas.</p>`,
  },
  {
    titre: `La carte`,
    corps: `<ul>
      <li><b>Combat</b> : un groupe de monstres.</li>
      <li><b>Combat dur</b> : des ennemis renforcés (le bonus est affiché au survol), mais un meilleur butin.</li>
      <li><b>Taverne</b> : soin et recrutement.</li>
      <li><b>Otomai</b> : augmente les chances de croiser des archimonstres pour le reste de la run.</li>
      <li><b>Zaap</b> : la rencontre n'est révélée qu'en arrivant.</li>
      <li><b>Hôtel de vente</b> : acheter et revendre des objets.</li>
      <li><b>Forgemage</b> : faire monter un objet d'une rareté.</li>
      <li><b>Rencontre</b> : un événement à choix (sanctuaire, coffre, marchand, idoles, avis de
        recherche, clé de donjon).</li>
      <li><b>Donjon</b> : le boss de la zone.</li>
    </ul>
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
      <p>Les kamas se gagnent en combat et en revendant des objets. Ils servent à l'hôtel de vente et chez
      le forgemage.</p>`,
  },
  {
    titre: `Ce qui reste après la mort`,
    corps: `<p>Les Dofus. Chacun donne un bonus permanent à toutes tes runs suivantes. On les obtient en
      terminant les groupes de quêtes du menu Succès.</p>
      <p>Restent aussi le bestiaire, l'armurerie et la progression des quêtes.</p>`,
  },
  {
    titre: `Archimonstres`,
    corps: `<p>N'importe quel monstre peut apparaître en version archimonstre, plus forte. Le vaincre
      l'ajoute au bestiaire. Le bestiaire complet donne le Dofus Ocre.</p>`,
  },
  {
    titre: `Obtenir équipement, Dofus et reliques`,
    corps: AIDE_OBTENTION,
  },
  {
    titre: `Ascension`,
    corps: `<p>Les étoiles sur l'image d'un monde règlent sa difficulté, de une (normal) à cinq. Gagner une
      run débloque l'étoile suivante, et gagner un monde ouvre le monde suivant.</p>`,
  },
];
export function ecranRegles() {
  return new Promise((resolve) => {
    afficherEcran(`
      <h1>Règles</h1>
      <div class="regles">
        ${SECTIONS_REGLES.map((e) => `<section class="regles-section"><h2>${e.titre}</h2>${e.corps}</section>`).join(``)}
      </div>
      ${barreRetour(`retour`)}
    `);
    racine.querySelector(`#retour`)?.addEventListener(`click`, () => resolve());
  });
}
