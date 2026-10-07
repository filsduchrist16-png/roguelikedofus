// Objectifs de succès réalisables dans le combat qui commence : quêtes de Dofus en jeu,
// reliques et âmes d'archimonstres à gagner. Affichés en début de combat.
import { DOFUS, MONSTRES, RELIQUES, SUCCES, ZONES } from "../data/index.js";
import { dofusDeSucces } from "./quetes.js";

function succesDeQuete(queteId) {
  return Object.values(SUCCES).find((s) => s.quetes.some((q) => q.id === queteId));
}

function dofusDeQuete(queteId) {
  const succes = succesDeQuete(queteId);
  const dofus = succes ? dofusDeSucces(succes) : undefined;
  return dofus ? DOFUS[dofus] : undefined;
}

const pct = (x) => `${Math.round(x * 1000) / 10} %`;

// Ce que le joueur doit faire pour qu'une quête « vaincre » se valide dans ce combat.
function consignesVaincre(c) {
  const conditions = [];
  if (c.sansKO) {
    conditions.push(`aucun héros ne doit tomber`);
  }
  if (c.toursMax !== undefined) {
    conditions.push(`gagne en ${c.toursMax} ronde${c.toursMax > 1 ? `s` : ``} au plus`);
  }
  if (c.bossPremier) {
    conditions.push(`achève le boss avant tous ses alliés`);
  }
  if (c.bossDernier) {
    conditions.push(`achève le boss après tous ses alliés`);
  }
  if (!conditions.length) {
    return c.boss ? `Bats-le pour valider la quête.` : `Gagne ce combat pour valider la quête.`;
  }
  const texte = conditions.join(` et `);
  return `À faire : ${texte}.`;
}

/**
 * @param {object} p
 * @param {{faites: string[]}} p.quetes  état des quêtes (meta)
 * @param {object[]} p.combattants
 * @param {string} p.combatId
 * @param {string} p.noeud       type de case (combat, combat_dur, donjon)
 * @param {string} [p.zoneId]
 * @param {string[]} p.classes   classes de l'équipe
 * @param {number} p.ascension
 * @param {string[]} p.archis    âmes déjà capturées
 * @param {string[]} p.reliques  reliques déjà obtenues
 * @param {number} [p.chanceRelique]
 * @param {boolean} [p.dernierDonjon]  ce donjon termine le monde
 * @param {object} [p.runSiVictoire]   état de la run si ce combat est gagné (pour les quêtes « gagner le monde »)
 */
export function objectifsDuCombat(p) {
  const faites = new Set(p.quetes?.faites ?? []);
  const ennemis = p.combattants.filter((c) => c.camp === `ennemi` && c.monstreId);
  const presents = new Set(ennemis.map((c) => c.monstreId));
  const objectifs = [];
  const ajouter = (o) => objectifs.push(o);

  for (const succes of Object.values(SUCCES)) {
    for (const q of succes.quetes) {
      if (faites.has(q.id)) {
        continue;
      }
      const c = q.critere;
      const dofus = dofusDeQuete(q.id);
      const base = { quete: q.nom, succes: succes.nom, img: dofus?.img, dofus: dofus?.nom };
      if (c.type === `vaincre`) {
        const possible =
          (c.boss === undefined || presents.has(c.boss)) &&
          (c.combat === undefined || c.combat === p.combatId) &&
          (c.noeud === undefined || c.noeud === p.noeud) &&
          (c.zone === undefined || c.zone === p.zoneId) &&
          (c.classe === undefined || p.classes.includes(c.classe)) &&
          (c.equipeMax === undefined || p.classes.length <= c.equipeMax) &&
          p.ascension >= (c.ascensionMin ?? 0);
        // Une quête « gagner n'importe quel combat » n'a rien de propre à ce combat.
        const cible = c.boss || c.combat || c.noeud || c.zone;
        if (possible && cible) {
          ajouter({ ...base, consigne: consignesVaincre(c) });
        }
      }
      if (
        c.type === `zone_terminee` &&
        p.noeud === `donjon` &&
        c.zone === p.zoneId &&
        p.ascension >= (c.ascensionMin ?? 0)
      ) {
        ajouter({
          ...base,
          consigne: `Gagne ce donjon pour terminer la zone « ${ZONES.find((z) => z.id === c.zone)?.nom ?? c.zone} ».`,
        });
      }
      if (
        c.type === `run_gagnee` &&
        p.dernierDonjon &&
        p.runSiVictoire &&
        conditionsRunTenues(c, p.runSiVictoire)
      ) {
        ajouter({
          ...base,
          consigne: `Gagne ce dernier donjon : le monde est remporté et la quête validée.`,
        });
      }
    }
  }

  // Reliques de boss (donjon seulement).
  if (p.noeud === `donjon`) {
    for (const id of presents) {
      if (RELIQUES[id] && !p.reliques.includes(id)) {
        const quete = Object.values(SUCCES)
          .flatMap((s) => s.quetes)
          .find((q) => q.critere.type === `relique_obtenue` && q.critere.boss === id);
        ajouter({
          quete: `Relique : ${RELIQUES[id].nom}`,
          succes: quete ? succesDeQuete(quete.id)?.nom : undefined,
          dofus: quete ? dofusDeQuete(quete.id)?.nom : undefined,
          img: `/assets/reliques/${id}.png`,
          consigne: `Vaincre ${MONSTRES[id]?.nom ?? id} : ${p.chanceRelique ? `${pct(p.chanceRelique)} de chance` : `petite chance`} de lâcher sa relique. Difficulté et prospection l'augmentent.`,
        });
      }
    }
  }

  // Archimonstres pas encore capturés.
  const captures = new Set(p.archis);
  for (const c of ennemis) {
    if (c.archi && !captures.has(c.monstreId)) {
      const m = MONSTRES[c.monstreId];
      ajouter({
        quete: `Âme de ${m?.archiNom ?? m?.nom ?? c.monstreId}`,
        succes: `Archimonstres`,
        dofus: DOFUS.dofus_ocre?.nom,
        img: DOFUS.dofus_ocre?.img,
        consigne: `Un archimonstre ! Gagne le combat pour capturer son âme (quêtes du Dofus Ocre).`,
      });
      captures.add(c.monstreId);
    }
  }
  return objectifs;
}

function conditionsRunTenues(c, r) {
  return !(
    (c.tranche !== undefined && r.trancheId !== c.tranche) ||
    (c.sansTaverne && r.tavernes > 0) ||
    (c.equipeMax !== undefined && r.tailleEquipe > c.equipeMax) ||
    (c.sansRecrutement && r.recrutements > 0) ||
    (c.classe !== undefined && !r.classes.includes(c.classe)) ||
    r.ascension < (c.ascensionMin ?? 0) ||
    (c.quatreHerosEquipes && !r.quatreHerosEquipes)
  );
}
