// Textes d'aide : comment obtenir un équipement, un Dofus, un archimonstre ou une relique.
import {
  BUTIN_ZONES,
  CLASSES,
  COMBATS,
  DOFUS,
  EQUIPEMENTS,
  MONDES,
  MONSTRES,
  SECRETS,
  SUCCES,
  ZONES,
} from "../data/index.js";
import { CONFIG_ARCHI, DIFFICULTES, TAUX_BUTIN, indexDebutMonde } from "./config.js";

const CATEGORIES = [
  [`normales`, `combats`],
  [`elites`, `combats durs`],
  [`boss`, `donjon`],
];

// Pour chaque objet : les zones (et le type de combat) où il peut tomber.
let sourcesParObjet = null;
function indexerSources() {
  sourcesParObjet = new Map();
  for (const monde of MONDES) {
    monde.zones.forEach((zoneId, indice) => {
      const butin = BUTIN_ZONES[indexDebutMonde(monde.id) + indice + 1];
      const zone = ZONES.find((zoneData) => zoneData.id === zoneId);
      if (!butin || !zone) {
        return;
      }
      for (const [cle, libelle] of CATEGORIES) {
        for (const id of butin[cle] ?? []) {
          if (!sourcesParObjet.has(id)) {
            sourcesParObjet.set(id, []);
          }
          sourcesParObjet.get(id).push({ zone: zone.nom, categorie: libelle });
        }
      }
    });
  }
}

export function sourcesObjet(id) {
  if (!sourcesParObjet) {
    indexerSources();
  }
  return sourcesParObjet.get(id) ?? [];
}

export function texteObtentionObjet(id) {
  const sources = sourcesObjet(id);
  const lignes = [];
  if (sources.length) {
    const parZone = new Map();
    for (const source of sources) {
      parZone.set(source.zone, [...(parZone.get(source.zone) ?? []), source.categorie]);
    }
    lignes.push(
      `Butin : ${[...parZone].map(([zone, cats]) => `${zone} (${[...new Set(cats)].join(`, `)})`).join(` · `)}.`,
    );
    lignes.push(
      `Aussi en vente à l'Hôtel de vente de ces zones (épique et plus) et de la zone précédente (rare et plus).`,
    );
  } else {
    const secret = Object.entries(SECRETS).find(([, secretDef]) => secretDef.butin.includes(id));
    lignes.push(
      secret
        ? `Récompense du donjon secret ${secret[1].nom} (${MONDES.find((monde) => monde.id === secret[0])?.nom}) : il s'ouvre avec une clé trouvée dans un coffre, chez un contrebandier (case Rencontre) ou sur un monstre de combat dur.`
        : EQUIPEMENTS[id]?.retire
          ? `Pièce d'une ancienne version du jeu : elle ne tombe plus, mais reste utilisable (Tier ${EQUIPEMENTS[id].toile ?? 1}).`
          : `Ne tombe dans aucune zone actuelle.`,
    );
  }
  const paliers = Object.keys(EQUIPEMENTS[id]?.tiers ?? {}).length;
  if (paliers > 1) {
    lignes.push(`La Forgemagie peut monter sa rareté.`);
  }
  return lignes.join(`\n`);
}

// Succès qui donne un Dofus, et ses quêtes.
export function succesDuDofus(dofusId) {
  return Object.values(SUCCES).find((succes) => succes.categorie?.dofus === dofusId);
}

export function mondeDuDofus(dofusId) {
  const succes = succesDuDofus(dofusId);
  return MONDES.find((monde) => monde.id === succes?.categorie?.monde);
}

export function texteObtentionDofus(dofusId) {
  const succes = succesDuDofus(dofusId);
  if (!succes) {
    return `Pas encore obtenable.`;
  }
  const monde = mondeDuDofus(dofusId);
  return `${monde ? `${monde.nom} — ` : ``}succès « ${succes.nom} » : ${succes.quetes.map((quete) => decrireQuete(quete).titre).join(` ; `)}.`;
}

// Règles d'obtention, avec les chiffres réels du jeu.
const pct = (ratio) => `${Math.round(ratio * 1000) / 10} %`;
export const AIDE_OBTENTION = `
  <p><b>Équipement.</b> Après chaque victoire, jusqu'à ${TAUX_BUTIN.tiragesMax} tirages de butin : chance par tirage de ${pct(TAUX_BUTIN.taux.combat)}
    en combat, ${pct(TAUX_BUTIN.taux.combat_dur)} en combat dur et ${pct(TAUX_BUTIN.taux.donjon)} au donjon. La prospection de
    l'équipe augmente ces chances (jusqu'à +${Math.round(TAUX_BUTIN.capProspection * 100)} %). Chaque zone a ses objets ; les
    combats durs et les donjons donnent aussi les objets d'élite et de boss. Survole un objet (ou touche-le) pour voir où il tombe.</p>
  <p><b>Hôtel de vente.</b> Il vend les objets de la zone en cours (épiques et plus) et de la zone suivante (rares et plus),
    et rachète ton inventaire à moitié prix. La <b>Forgemagie</b> monte la rareté d'un objet, même équipé.</p>
  <p><b>Dofus.</b> Chaque Dofus récompense un succès (menu Succès sur l'accueil), repris des succès de Dofus 3. Chacun
    a ses quêtes dans le monde de sa tranche de niveau réelle (Dofawa, Argenté, Jyfus et Cacao dans le Monde 1… jusqu'aux
    Dofus de niveau 200 dans le Monde 5) et s'obtient dès que son succès est terminé, sans attendre les autres. Ils
    restent acquis pour toutes les runs.</p>
  <p><b>Archimonstres.</b> Un monstre a ${pct(CONFIG_ARCHI.chance)} de chance d'apparaître sous sa forme d'archimonstre,
    plus ${pct(CONFIG_ARCHI.philtre)} par philtre d'Otomaï bu pendant la run (${CONFIG_ARCHI.philtresMax} au maximum).
    Un archimonstre <b>jamais capturé</b> apparaît ${CONFIG_ARCHI.multNouveau} fois plus souvent, et chaque combat sans
    archi inédit remplit la <b>jauge de traque</b> (+${pct(CONFIG_ARCHI.bonusParCombatSansNouveau)} par combat, jusqu'à
    +${pct(CONFIG_ARCHI.bonusSansNouveauMax)}, gardée d'une run à l'autre). Un avis de recherche vise d'abord un archi
    qui te manque. Bats-le pour capturer son âme : le Bestiaire montre ceux qui manquent et où les trouver.</p>
  <p><b>Reliques.</b> Les boss de donjon lâchent rarement une relique ; la difficulté et la prospection de l'équipe augmentent
    la chance. Le Bestiaire indique quel boss lâche quoi.</p>`;

// Où rencontrer chaque monstre : zones, monde et type de combat.
let lieuxParMonstre = null;
const TYPES_POOL = [
  [`normales`, `cases combat`],
  [`elite`, `cases combat dur`],
  [`boss`, `case donjon, en fin de zone`],
];
function indexerLieux() {
  lieuxParMonstre = new Map();
  for (const monde of MONDES) {
    monde.zones.forEach((zoneId, indice) => {
      const zone = ZONES.find((zoneData) => zoneData.id === zoneId);
      if (!zone?.pools) {
        return;
      }
      for (const [cle, libelle] of TYPES_POOL) {
        for (const combatId of zone.pools[cle] ?? []) {
          for (const { monstre } of COMBATS[combatId]?.ennemis ?? []) {
            const lieux = lieuxParMonstre.get(monstre) ?? [];
            if (!lieux.some((lieu) => lieu.zoneId === zoneId && lieu.type === libelle)) {
              lieux.push({
                zoneId,
                zone: zone.nom,
                monde: monde.nom,
                num: indice + 1,
                type: libelle,
              });
            }
            lieuxParMonstre.set(monstre, lieux);
          }
        }
      }
    });
    // donjon secret du monde (ouvert avec une clé)
    const secret = SECRETS[monde.id];
    for (const { monstre } of COMBATS[secret?.combat]?.ennemis ?? []) {
      const lieux = lieuxParMonstre.get(monstre) ?? [];
      lieux.push({
        zoneId: null,
        zone: secret.nom,
        monde: monde.nom,
        secret: true,
        type: `donjon secret`,
      });
      lieuxParMonstre.set(monstre, lieux);
    }
  }
}
export function lieuxMonstre(id) {
  if (!lieuxParMonstre) {
    indexerLieux();
  }
  return lieuxParMonstre.get(id) ?? [];
}
export function texteLieuxMonstre(id) {
  const lieux = lieuxMonstre(id);
  if (!lieux.length) {
    return `n'apparaît dans aucune zone pour l'instant`;
  }
  return lieux
    .map((lieu) =>
      lieu.secret
        ? `« ${lieu.zone} », donjon secret du ${lieu.monde} (il s'ouvre avec une clé, après le boss d'une zone)`
        : `« ${lieu.zone} » (${lieu.monde}, zone ${lieu.num}), ${lieu.type}`,
    )
    .join(` ; ou `);
}
const nomZone = (id) => ZONES.find((zoneData) => zoneData.id === id)?.nom ?? id;
const nomMonde = (id) => MONDES.find((monde) => monde.id === id)?.nom ?? id;
const nomClasse = (id) => CLASSES[id]?.nom ?? id;
const nomDifficulte = (cran) => DIFFICULTES[cran]?.nom ?? `?`;
const ELEMENTS_NOMS = { terre: `Terre`, feu: `Feu`, eau: `Eau`, air: `Air` };

// Conditions particulières d'une quête, en phrases courtes.
function conditionsQuete(critere) {
  const conditions = [];
  if (critere.sansKO) {
    conditions.push(`aucun héros ne doit tomber`);
  }
  if (critere.toursMax !== undefined) {
    conditions.push(`gagne en ${critere.toursMax} rondes au plus (joue offensif)`);
  }
  if (critere.equipeMax !== undefined) {
    conditions.push(
      `${critere.equipeMax} héros au plus dans l'équipe (avant d'en recruter d'autres)`,
    );
  }
  if (critere.bossPremier) {
    conditions.push(`le boss doit tomber en premier, avant ses alliés`);
  }
  if (critere.bossDernier) {
    conditions.push(`le boss doit tomber en dernier, après ses alliés`);
  }
  if (critere.classe !== undefined) {
    conditions.push(`un ${nomClasse(critere.classe)} doit être dans l'équipe`);
  }
  if (critere.ascensionMin) {
    conditions.push(
      `difficulté ${nomDifficulte(critere.ascensionMin)} ou plus, choisie au lancement de la run`,
    );
  }
  return conditions;
}

// Texte « Où / Comment » d'une quête, selon son critère : [[étiquette, texte], …].
function lignesQuete(critere) {
  const lignes = [];
  const conditions = conditionsQuete(critere);
  switch (critere.type) {
    case `vaincre`:
      if (critere.boss) {
        lignes.push([`Où`, `${texteLieuxMonstre(critere.boss)}.`]);
      } else if (critere.noeud === `combat_dur`) {
        lignes.push([`Où`, `sur une case rouge de la carte (combat dur : ennemis renforcés).`]);
      } else if (critere.zone && critere.noeud === `donjon`) {
        const monde = MONDES.find((mondeCandidat) => mondeCandidat.zones.includes(critere.zone));
        lignes.push([
          `Où`,
          `dernière case (donjon) de « ${nomZone(critere.zone)} »${monde ? `, ${monde.nom} (zone ${monde.zones.indexOf(critere.zone) + 1})` : ``}.`,
        ]);
      } else if (critere.zone) {
        lignes.push([`Où`, `n'importe quel combat de la zone « ${nomZone(critere.zone)} ».`]);
      } else {
        lignes.push([`Où`, `n'importe quel combat.`]);
      }
      break;
    case `zone_terminee`:
      lignes.push([
        `Où`,
        `bats le donjon (dernière case) de « ${nomZone(critere.zone)} » pendant une run.`,
      ]);
      break;
    case `run_gagnee`: {
      lignes.push([
        `Comment`,
        critere.tranche
          ? `bats le dernier donjon du ${nomMonde(critere.tranche)} pour gagner la run.`
          : `gagne une run, dans n'importe quel monde.`,
      ]);
      if (critere.sansTaverne) {
        conditions.push(`n'entre dans aucune taverne (évite ces cases sur la carte)`);
      }
      if (critere.sansRecrutement) {
        conditions.push(`ne recrute personne en taverne (tu peux y entrer pour te soigner)`);
      }
      if (critere.equipeMax !== undefined && critere.type === `run_gagnee`) {
        conditions.push(`pas plus de ${critere.equipeMax} héros`);
      }
      if (critere.quatreHerosEquipes) {
        conditions.push(
          `4 héros avec leurs 8 emplacements remplis à la fin (arme, coiffe, cape, amulette, 2 anneaux, ceinture, bottes)`,
        );
      }
      break;
    }
    case `compteur`:
      if (critere.evenement === `degats_element`) {
        const classes = Object.values(CLASSES)
          .filter((classe) => classe.elements?.includes(critere.element))
          .map((classe) => classe.nom);
        lignes.push([
          `Comment`,
          `inflige ces dégâts avec des sorts ${ELEMENTS_NOMS[critere.element] ?? critere.element} (${classes.join(`, `)}). Le total se cumule d'une run à l'autre.`,
        ]);
      } else if (critere.evenement === `soins`) {
        lignes.push([
          `Comment`,
          `soigne tes héros en combat (Eniripsa en tête, puis Pandawa, Sadida, Ouginak, Éliotrope). Le total se cumule d'une run à l'autre.`,
        ]);
      } else {
        lignes.push([
          `Comment`,
          `bats des monstres, dans tous les combats. Le total se cumule d'une run à l'autre.`,
        ]);
      }
      break;
    case `archi_capture`:
      lignes.push([
        `Comment`,
        critere.tranche
          ? `bats les archimonstres du ${nomMonde(critere.tranche)} : ils apparaissent au hasard dans ses zones (plus souvent avec des philtres d'Otomaï). Le Bestiaire montre ceux qui manquent.`
          : critere.zone
            ? `bats tous les archimonstres de « ${nomZone(critere.zone)} » (voir le Bestiaire).`
            : `bats tous les archimonstres d'une même zone : ils apparaissent au hasard, le Bestiaire montre ceux qui manquent.`,
      ]);
      break;
    case `record_ascension`:
      lignes.push([
        `Comment`,
        `choisis la difficulté ${nomDifficulte(critere.min)} au lancement d'une run du ${nomMonde(critere.tranche)}, puis gagne-la.`,
      ]);
      break;
    case `relique_obtenue`:
      lignes.push([`Où`, `${texteLieuxMonstre(critere.boss)}.`]);
      lignes.push([
        `Astuce`,
        `${MONSTRES[critere.boss]?.nom ?? critere.boss} ne la lâche que parfois : la difficulté et la prospection augmentent la chance.`,
      ]);
      break;
    case `archis_total`:
      lignes.push([
        `Comment`,
        `capture des âmes d'archimonstres ; le total compte toutes les runs.`,
      ]);
      break;
    case `objet_obtenu`:
      lignes.push([`Où`, texteObtentionObjet(critere.objet).split(`\n`)[0]]);
      break;
    case `dofus_possede`:
      lignes.push([
        `Comment`,
        `obtiens d'abord le ${DOFUS[critere.dofus]?.nom ?? critere.dofus} : ${texteObtentionDofus(critere.dofus)}`,
      ]);
      break;
    case `dofus_possedes`:
      lignes.push([`Comment`, `termine d'autres succès de Dofus pour les obtenir.`]);
      break;
    case `runs_jouees`:
      lignes.push([`Comment`, `chaque run lancée compte, gagnée ou non.`]);
      break;
  }
  if (conditions.length) {
    lignes.push([`Condition`, `${conditions.join(` ; `)}.`]);
  }
  return lignes;
}

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

/**
 * Description d'une quête en clair : { titre, lore, lignes }.
 * titre : ce qu'il faut faire, en une phrase simple ; lore : le titre du succès dans Dofus (s'il y en
 * a un), à part ; lignes : [étiquette, texte] (Où / Comment / Condition).
 */
export function decrireQuete(quete) {
  let texte = quete.nom.replace(/\.$/, ``);
  let lore = ``;
  const citation = texte.match(/^«\s*(.+?)\s*»\s*:\s*(.+)$/);
  if (citation) {
    [, lore, texte] = citation;
  } else {
    // « Kardorim (Duo) : vaincre… » : le préfixe répète la quête ; « Titre : action » : titre = lore
    const prefixe = texte.match(/^([^:]+?)\s:\s(.+)$/);
    if (prefixe) {
      const titre = prefixe[1].replace(/\s*\(.+\)\s*$/, ``);
      lore = prefixe[2].includes(titre) ? `` : titre;
      texte = prefixe[2];
    }
  }
  return { titre: majuscule(texte), lore, lignes: lignesQuete(quete.critere) };
}

// Indice en une chaîne (infobulles) : « Où : … Condition : … ».
export function indiceQuete(quete) {
  const { lignes } = decrireQuete(quete);
  return lignes.map(([etiquette, texte]) => `${etiquette} : ${texte}`).join(` `);
}
