// Textes d'aide : comment obtenir un équipement, un Dofus, un archimonstre ou une relique.
import { BUTIN_ZONES, EQUIPEMENTS, MONDES, SUCCES, ZONES } from "../data/index.js";
import { CONFIG_ARCHI, TAUX_BUTIN, indexDebutMonde } from "./config.js";

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
    lignes.push(`Ne tombe dans aucune zone actuelle.`);
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

export function texteObtentionDofus(dofusId) {
  const succes = succesDuDofus(dofusId);
  if (!succes) {
    return `Pas encore obtenable.`;
  }
  return `Succès « ${succes.nom} » : ${succes.quetes.map((q) => q.nom.replace(/\.$/, ``)).join(` ; `)}.`;
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
  <p><b>Dofus.</b> Chaque Dofus récompense un succès (menu Succès sur l'accueil) : vaincre certains boss, terminer des zones,
    gagner un monde sous condition, cumuler des dégâts ou des soins… Ils restent acquis pour toutes les runs.</p>
  <p><b>Archimonstres.</b> Un monstre a ${pct(CONFIG_ARCHI.chance)} de chance d'apparaître sous sa forme d'archimonstre,
    plus ${pct(CONFIG_ARCHI.philtre)} par philtre d'Otomai bu pendant la run (${CONFIG_ARCHI.philtresMax} au maximum).
    Bats-le pour capturer son âme.</p>
  <p><b>Reliques.</b> Les boss de donjon lâchent rarement une relique ; la difficulté et la prospection de l'équipe augmentent
    la chance. Le Bestiaire indique quel boss lâche quoi.</p>`;
