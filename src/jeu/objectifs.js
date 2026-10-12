// Objectifs de succès réalisables dans le combat qui commence : quêtes de Dofus en jeu,
// reliques et âmes d'archimonstres à gagner. Affichés en début de combat.
import { DOFUS, MONSTRES, RELIQUES, SUCCES, ZONES } from "../data/index.js";
import { dofusDeSucces } from "./quetes.js";
import { decrireQuete } from "./obtention.js";

function succesDeQuete(queteId) {
  return Object.values(SUCCES).find((succes) =>
    succes.quetes.some((quete) => quete.id === queteId),
  );
}

function dofusDeQuete(queteId) {
  const succes = succesDeQuete(queteId);
  const dofus = succes ? dofusDeSucces(succes) : undefined;
  return dofus ? DOFUS[dofus] : undefined;
}

const pct = (ratio) => `${Math.round(ratio * 1000) / 10} %`;

// Ce que le joueur doit faire pour qu'une quête « vaincre » se valide dans ce combat.
function consignesVaincre(critere) {
  const conditions = [];
  if (critere.sansKO) {
    conditions.push(`aucun héros ne doit tomber`);
  }
  if (critere.toursMax !== undefined) {
    conditions.push(`gagne en ${critere.toursMax} ronde${critere.toursMax > 1 ? `s` : ``} au plus`);
  }
  if (critere.bossPremier) {
    conditions.push(`achève le boss avant tous ses alliés`);
  }
  if (critere.bossDernier) {
    conditions.push(`achève le boss après tous ses alliés`);
  }
  if (!conditions.length) {
    return critere.boss
      ? `Bats-le pour valider la quête.`
      : `Gagne ce combat pour valider la quête.`;
  }
  const texte = conditions.join(` et `);
  return `À faire : ${texte}.`;
}

/**
 * @param {object} contexte
 * @param {{faites: string[]}} contexte.quetes  état des quêtes (meta)
 * @param {object[]} contexte.combattants
 * @param {string} contexte.combatId
 * @param {string} contexte.noeud       type de case (combat, combat_dur, donjon)
 * @param {string} [contexte.zoneId]
 * @param {string[]} contexte.classes   classes de l'équipe
 * @param {number} contexte.ascension
 * @param {string[]} contexte.archis    âmes déjà capturées
 * @param {string[]} contexte.reliques  reliques déjà obtenues
 * @param {number} [contexte.chanceRelique]
 * @param {boolean} [contexte.dernierDonjon]  ce donjon termine le monde
 * @param {object} [contexte.runSiVictoire]   état de la run si ce combat est gagné (pour les quêtes « gagner le monde »)
 */
export function objectifsDuCombat(contexte) {
  const faites = new Set(contexte.quetes?.faites ?? []);
  const ennemis = contexte.combattants.filter(
    (combattant) => combattant.camp === `ennemi` && combattant.monstreId,
  );
  const presents = new Set(ennemis.map((combattant) => combattant.monstreId));
  const objectifs = [];
  const ajouter = (objectif) => objectifs.push(objectif);

  for (const succes of Object.values(SUCCES)) {
    for (const quete of succes.quetes) {
      if (faites.has(quete.id)) {
        continue;
      }
      const critere = quete.critere;
      const dofus = dofusDeQuete(quete.id);
      const description = decrireQuete(quete);
      const base = {
        quete: description.titre,
        lore: description.lore,
        succes: succes.nom,
        img: dofus?.img,
        dofus: dofus?.nom,
      };
      if (critere.type === `vaincre`) {
        const possible =
          (critere.boss === undefined || presents.has(critere.boss)) &&
          (critere.combat === undefined || critere.combat === contexte.combatId) &&
          (critere.noeud === undefined || critere.noeud === contexte.noeud) &&
          (critere.zone === undefined || critere.zone === contexte.zoneId) &&
          (critere.classe === undefined || contexte.classes.includes(critere.classe)) &&
          (critere.equipeMax === undefined || contexte.classes.length <= critere.equipeMax) &&
          contexte.ascension >= (critere.ascensionMin ?? 0);
        // Une quête « gagner n'importe quel combat » n'a rien de propre à ce combat.
        const cible = critere.boss || critere.combat || critere.noeud || critere.zone;
        if (possible && cible) {
          ajouter({
            ...base,
            consigne: consignesVaincre(critere),
            suivi: {
              type: `vaincre`,
              boss: critere.boss,
              sansKO: critere.sansKO,
              toursMax: critere.toursMax,
            },
          });
        }
      }
      // compteurs (monstres vaincus, dégâts d'un élément, soins) qui avancent dans ce combat
      if (critere.type === `compteur`) {
        const fait = contexte.quetes?.compteurs?.[quete.id] ?? 0;
        const utile =
          critere.evenement === `monstre_vaincu`
            ? (critere.zone === undefined || critere.zone === contexte.zoneId) &&
              (critere.espece === undefined || presents.has(critere.espece))
            : critere.evenement === `degats_element`
              ? (contexte.elements ?? []).includes(critere.element)
              : critere.evenement === `soins`
                ? !!contexte.soigneurs
                : false;
        if (utile && fait < critere.seuil) {
          ajouter({
            ...base,
            consigne: `Progression gardée d'un combat à l'autre.`,
            suivi: {
              type: `compteur`,
              evenement: critere.evenement,
              element: critere.element,
              espece: critere.espece,
              base: fait,
              seuil: critere.seuil,
            },
          });
        }
      }
      if (
        critere.type === `zone_terminee` &&
        contexte.noeud === `donjon` &&
        critere.zone === contexte.zoneId &&
        contexte.ascension >= (critere.ascensionMin ?? 0)
      ) {
        ajouter({
          ...base,
          consigne: `Gagne ce donjon pour terminer la zone « ${ZONES.find((zone) => zone.id === critere.zone)?.nom ?? critere.zone} ».`,
        });
      }
      if (
        critere.type === `run_gagnee` &&
        contexte.dernierDonjon &&
        contexte.runSiVictoire &&
        conditionsRunTenues(critere, contexte.runSiVictoire)
      ) {
        ajouter({
          ...base,
          consigne: `Gagne ce dernier donjon : le monde est remporté et la quête validée.`,
        });
      }
    }
  }

  // Reliques de boss (donjon seulement).
  if (contexte.noeud === `donjon`) {
    for (const id of presents) {
      if (RELIQUES[id] && !contexte.reliques.includes(id)) {
        const quete = Object.values(SUCCES)
          .flatMap((succes) => succes.quetes)
          .find(
            (queteDuSucces) =>
              queteDuSucces.critere.type === `relique_obtenue` && queteDuSucces.critere.boss === id,
          );
        ajouter({
          quete: `Relique : ${RELIQUES[id].nom}`,
          succes: quete ? succesDeQuete(quete.id)?.nom : undefined,
          dofus: quete ? dofusDeQuete(quete.id)?.nom : undefined,
          img: `/assets/reliques/${id}.png`,
          consigne: `Vaincre ${MONSTRES[id]?.nom ?? id} : ${contexte.chanceRelique ? `${pct(contexte.chanceRelique)} de chance` : `petite chance`} de lâcher sa relique. Difficulté et prospection l'augmentent.`,
        });
      }
    }
  }

  // Archimonstres pas encore capturés.
  const captures = new Set(contexte.archis);
  for (const ennemi of ennemis) {
    if (ennemi.archi && !captures.has(ennemi.monstreId)) {
      const monstre = MONSTRES[ennemi.monstreId];
      ajouter({
        quete: `Âme de ${monstre?.archiNom ?? monstre?.nom ?? ennemi.monstreId}`,
        succes: `Archimonstres`,
        dofus: DOFUS.dofus_ocre?.nom,
        img: DOFUS.dofus_ocre?.img,
        consigne: `Un archimonstre ! Gagne le combat pour capturer son âme (quêtes du Dofus Ocre).`,
      });
      captures.add(ennemi.monstreId);
    }
  }
  return objectifs;
}

function conditionsRunTenues(critere, run) {
  return !(
    (critere.tranche !== undefined && run.trancheId !== critere.tranche) ||
    (critere.sansTaverne && run.tavernes > 0) ||
    (critere.equipeMax !== undefined && run.tailleEquipe > critere.equipeMax) ||
    (critere.sansRecrutement && run.recrutements > 0) ||
    (critere.classe !== undefined && !run.classes.includes(critere.classe)) ||
    run.ascension < (critere.ascensionMin ?? 0) ||
    (critere.quatreHerosEquipes && !run.quatreHerosEquipes)
  );
}

/**
 * État d'un objectif pendant le combat : { etat: `en_cours` | `assure` | `rate`, detail }.
 * `assure` = validé si le combat est gagné.
 */
export function etatObjectif(objectif, suivi, combattants) {
  const spec = objectif.suivi;
  if (!spec) {
    return { etat: `en_cours` };
  }
  const mort = (combattant) => suivi.morts.has(combattant.ref) || combattant.pvActuels <= 0;
  if (spec.type === `vaincre`) {
    if (
      spec.sansKO &&
      combattants.some(
        (combattant) =>
          combattant.camp === `joueur` &&
          !combattant.creature &&
          combattant.pvActuels <= 0 &&
          // les héros déjà K.O. avant le combat ne comptent pas
          (!suivi.herosDepart || suivi.herosDepart.includes(combattant.ref)),
      )
    ) {
      return { etat: `rate`, detail: `un héros est tombé` };
    }
    if (spec.toursMax !== undefined && suivi.rondes > spec.toursMax) {
      return { etat: `rate`, detail: `trop de rondes` };
    }
    const ronde =
      spec.toursMax !== undefined
        ? `ronde ${Math.max(1, suivi.rondes)}/${spec.toursMax}`
        : undefined;
    if (spec.boss) {
      const boss = combattants.filter(
        (combattant) => combattant.camp === `ennemi` && combattant.monstreId === spec.boss,
      );
      if (boss.length && boss.every(mort)) {
        return { etat: `assure`, detail: ronde ?? `vaincu` };
      }
    }
    return { etat: `en_cours`, detail: ronde };
  }
  if (spec.type === `compteur`) {
    let gagne = 0;
    if (spec.evenement === `monstre_vaincu`) {
      gagne = combattants.filter(
        (combattant) =>
          combattant.camp === `ennemi` &&
          combattant.monstreId &&
          !combattant.estLance &&
          (spec.espece === undefined || combattant.monstreId === spec.espece) &&
          mort(combattant),
      ).length;
    } else if (spec.evenement === `degats_element`) {
      gagne = Math.round(suivi.degats?.[spec.element] ?? 0);
    } else if (spec.evenement === `soins`) {
      gagne = Math.round(suivi.soins ?? 0);
    }
    const total = Math.min(spec.seuil, spec.base + gagne);
    return {
      etat: total >= spec.seuil ? `assure` : `en_cours`,
      detail: `${total.toLocaleString(`fr-FR`)}/${spec.seuil.toLocaleString(`fr-FR`)}`,
    };
  }
  return { etat: `en_cours` };
}
