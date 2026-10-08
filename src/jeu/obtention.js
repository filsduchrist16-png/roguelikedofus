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
    monde.zones.forEach((zoneId, i) => {
      const butin = BUTIN_ZONES[indexDebutMonde(monde.id) + i + 1];
      const zone = ZONES.find((z) => z.id === zoneId);
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
    for (const s of sources) {
      parZone.set(s.zone, [...(parZone.get(s.zone) ?? []), s.categorie]);
    }
    lignes.push(
      `Butin : ${[...parZone].map(([zone, cats]) => `${zone} (${[...new Set(cats)].join(`, `)})`).join(` · `)}.`,
    );
    lignes.push(
      `Aussi en vente à l'Hôtel de vente de ces zones (épique et plus) et de la zone précédente (rare et plus).`,
    );
  } else {
    const secret = Object.entries(SECRETS).find(([, d]) => d.butin.includes(id));
    lignes.push(
      secret
        ? `Récompense du donjon secret ${secret[1].nom} (${MONDES.find((m) => m.id === secret[0])?.nom}) : il s'ouvre avec une clé trouvée dans un coffre, chez un contrebandier (case Rencontre) ou sur un monstre de combat dur.`
        : `Ne tombe dans aucune zone actuelle.`,
    );
  }
  const paliers = Object.keys(EQUIPEMENTS[id]?.tiers ?? {}).length;
  if (paliers > 1) {
    lignes.push(`Le Forgemage peut monter sa rareté.`);
  }
  return lignes.join(`\n`);
}

// Succès qui donne un Dofus, et ses quêtes.
export function succesDuDofus(dofusId) {
  return Object.values(SUCCES).find((s) => s.categorie?.dofus === dofusId);
}

export function mondeDuDofus(dofusId) {
  const succes = succesDuDofus(dofusId);
  return MONDES.find((m) => m.id === succes?.categorie?.monde);
}

export function texteObtentionDofus(dofusId) {
  const succes = succesDuDofus(dofusId);
  if (!succes) {
    return `Pas encore obtenable.`;
  }
  const monde = mondeDuDofus(dofusId);
  return `${monde ? `${monde.nom} — ` : ``}succès « ${succes.nom} » : ${succes.quetes.map((q) => q.nom.replace(/\.$/, ``)).join(` ; `)}.`;
}

// Règles d'obtention, avec les chiffres réels du jeu.
const pct = (x) => `${Math.round(x * 1000) / 10} %`;
export const AIDE_OBTENTION = `
  <p><b>Équipement.</b> Après chaque victoire, jusqu'à 4 tirages de butin : ${pct(TAUX_BUTIN.taux.combat)} de chance par tirage
    en combat, ${pct(TAUX_BUTIN.taux.combat_dur)} en combat dur et ${pct(TAUX_BUTIN.taux.donjon)} au donjon. La prospection de
    l'équipe augmente ces chances (jusqu'à +${Math.round(TAUX_BUTIN.capProspection * 100)} %). Chaque zone a ses objets ; les
    combats durs et les donjons donnent aussi les objets d'élite et de boss. Survole un objet pour voir où il tombe.</p>
  <p><b>Hôtel de vente.</b> Il vend les objets de la zone en cours (épiques et plus) et de la zone suivante (rares et plus),
    et rachète ton inventaire à moitié prix. Le <b>Forgemage</b> monte la rareté d'un objet, même équipé.</p>
  <p><b>Dofus.</b> Chaque Dofus récompense un succès (menu Succès sur l'accueil), repris des succès de Dofus 3. Ils
    s'obtiennent dans l'ordre de leur niveau réel : Dofawa, Argenté, Jyfus et Cacao dans le Monde 1… jusqu'aux Dofus de
    niveau 200 (Glaces, Abyssal, Ivoire, Ébène, Cauchemar…) dans le Monde 5. Ils restent acquis pour toutes les runs.</p>
  <p><b>Archimonstres.</b> Un monstre a ${pct(CONFIG_ARCHI.chance)} de chance d'apparaître sous sa forme d'archimonstre,
    plus ${pct(CONFIG_ARCHI.philtre)} par philtre d'Otomai bu pendant la run (${CONFIG_ARCHI.philtresMax} au maximum).
    Bats-le pour capturer son âme.</p>
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
    monde.zones.forEach((zoneId, i) => {
      const zone = ZONES.find((z) => z.id === zoneId);
      if (!zone?.pools) {
        return;
      }
      for (const [cle, libelle] of TYPES_POOL) {
        for (const combatId of zone.pools[cle] ?? []) {
          for (const { monstre } of COMBATS[combatId]?.ennemis ?? []) {
            const lieux = lieuxParMonstre.get(monstre) ?? [];
            if (!lieux.some((l) => l.zoneId === zoneId && l.type === libelle)) {
              lieux.push({ zoneId, zone: zone.nom, monde: monde.nom, num: i + 1, type: libelle });
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
    .map((l) =>
      l.secret
        ? `« ${l.zone} », donjon secret du ${l.monde} (il s'ouvre avec une clé, après le boss d'une zone)`
        : `« ${l.zone} » (${l.monde}, zone ${l.num}), ${l.type}`,
    )
    .join(` ; ou `);
}
const nomZone = (id) => ZONES.find((z) => z.id === id)?.nom ?? id;
const nomMonde = (id) => MONDES.find((m) => m.id === id)?.nom ?? id;
const nomClasse = (id) => CLASSES[id]?.nom ?? id;
const nomDifficulte = (cran) => DIFFICULTES[cran]?.nom ?? `?`;
const ELEMENTS_NOMS = { terre: `Terre`, feu: `Feu`, eau: `Eau`, air: `Air` };

// Indice affiché sous une quête : où aller et comment s'y prendre.
export function indiceQuete(quete) {
  const c = quete.critere;
  const conditions = [];
  if (c.sansKO) {
    conditions.push(`aucun héros ne doit tomber pendant le combat`);
  }
  if (c.toursMax !== undefined) {
    conditions.push(`finis en ${c.toursMax} rondes au plus : vise les dégâts`);
  }
  if (c.equipeMax !== undefined) {
    conditions.push(`${c.equipeMax} héros au plus dans l'équipe (avant d'en recruter d'autres)`);
  }
  if (c.bossPremier) {
    conditions.push(`le boss doit tomber avant tous ses alliés`);
  }
  if (c.bossDernier) {
    conditions.push(`le boss doit tomber après tous ses alliés`);
  }
  if (c.classe !== undefined) {
    conditions.push(`un ${nomClasse(c.classe)} doit être dans l'équipe`);
  }
  if (c.ascensionMin) {
    conditions.push(`difficulté ${nomDifficulte(c.ascensionMin)} ou plus (au lancement de la run)`);
  }
  const suite = conditions.length ? ` Condition : ${conditions.join(`, `)}.` : ``;
  switch (c.type) {
    case `vaincre`:
      if (c.boss) {
        return `${MONSTRES[c.boss]?.nom ?? c.boss} : ${texteLieuxMonstre(c.boss)}.${suite}`;
      }
      if (c.noeud === `combat_dur`) {
        return `N'importe quel combat dur (case rouge de la carte, ennemis renforcés).${suite}`;
      }
      if (c.zone && c.noeud === `donjon`) {
        const monde = MONDES.find((m) => m.zones.includes(c.zone));
        return `Le donjon (dernière case) de la zone « ${nomZone(c.zone)} »${monde ? ` (${monde.nom}, zone ${monde.zones.indexOf(c.zone) + 1})` : ``}.${suite}`;
      }
      if (c.zone) {
        return `Un combat de la zone « ${nomZone(c.zone)} ».${suite}`;
      }
      return `N'importe quel combat.${suite}`;
    case `zone_terminee`:
      return `Bats le donjon (dernière case) de la zone « ${nomZone(c.zone)} » pendant une run.${suite}`;
    case `run_gagnee`: {
      const lieu = c.tranche
        ? `Bats le dernier donjon du ${nomMonde(c.tranche)}`
        : `Gagne une run, dans n'importe quel monde`;
      const extra = [];
      if (c.sansTaverne) {
        extra.push(`n'entre dans aucune taverne (évite ces cases sur la carte)`);
      }
      if (c.sansRecrutement) {
        extra.push(`ne recrute personne en taverne (tu peux y entrer pour te soigner)`);
      }
      if (c.equipeMax !== undefined) {
        extra.push(`pas plus de ${c.equipeMax} héros`);
      }
      if (c.quatreHerosEquipes) {
        extra.push(`4 héros avec arme, coiffe, cape et anneau à la fin`);
      }
      return `${lieu}.${suite}${extra.length ? ` À respecter : ${extra.join(`, `)}.` : ``}`;
    }
    case `compteur`:
      if (c.evenement === `degats_element`) {
        const classes = Object.values(CLASSES)
          .filter((k) => k.elements?.includes(c.element))
          .map((k) => k.nom);
        return `Se cumule d'une run à l'autre. Sorts ${ELEMENTS_NOMS[c.element] ?? c.element} : ${classes.join(`, `)}.`;
      }
      if (c.evenement === `soins`) {
        return `Se cumule d'une run à l'autre. Les soins de l'Eniripsa (le meilleur), du Pandawa, du Sadida, de l'Ouginak ou de l'Éliotrope font avancer ce compteur.`;
      }
      return `Se cumule d'une run à l'autre, dans tous les combats.`;
    case `archi_capture`:
      if (c.tranche) {
        return `Les archimonstres apparaissent au hasard dans les zones du ${nomMonde(c.tranche)} (plus souvent avec des philtres d'Otomai). Le Bestiaire montre ceux qui manquent.`;
      }
      if (c.zone) {
        return `Archimonstres de ${nomZone(c.zone)} : voir le Bestiaire.`;
      }
      return `Les archimonstres apparaissent au hasard ; le Bestiaire montre ceux qui manquent par zone.`;
    case `record_ascension`:
      return `Choisis la difficulté ${nomDifficulte(c.min)} au lancement d'une run du ${nomMonde(c.tranche)}, puis gagne-la.`;
    case `relique_obtenue`:
      return `${MONSTRES[c.boss]?.nom ?? c.boss} (${texteLieuxMonstre(c.boss)}) la lâche parfois. La difficulté et la prospection augmentent la chance.`;
    case `archis_total`:
      return `Total d'âmes capturées, toutes runs confondues.`;
    case `objet_obtenu`:
      return `Objet à trouver : ${texteObtentionObjet(c.objet).split(`\n`)[0]}`;
    case `dofus_possede`:
      return `Obtiens d'abord le ${DOFUS[c.dofus]?.nom ?? c.dofus} : ${texteObtentionDofus(c.dofus)}`;
    case `dofus_possedes`:
      return `Termine d'autres succès de Dofus.`;
    case `runs_jouees`:
      return `Chaque run lancée compte, gagnée ou non.`;
  }
  return ``;
}
