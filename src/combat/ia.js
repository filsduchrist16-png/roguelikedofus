import { SORTS } from "../data/index.js";
import { alliesVivants, ciblesValides, coutPA } from "./stats.js";
import { peutInvoquer } from "./effets.js";
function iaAgressive(acteur, combattants) {
  let sortInvocation = acteur.sorts
    .map((idSort) => SORTS[idSort])
    .find(
      (sort) =>
        sort.type === `invocation` &&
        acteur.paActuels >= coutPA(sort, acteur) &&
        ciblesValides(acteur, sort, combattants).length > 0 &&
        peutInvoquer(acteur, sort, combattants),
    );
  if (sortInvocation) {
    return {
      sort: sortInvocation,
      cibleRef: acteur.ref,
    };
  }
  let sortsDegats = acteur.sorts
    .map((idSort) => SORTS[idSort])
    .filter((sort) => sort.type === `degats` && acteur.paActuels >= coutPA(sort, acteur))
    .sort((premier, second) => coutPA(second, acteur) - coutPA(premier, acteur));
  for (let sort of sortsDegats) {
    let cibles = ciblesValides(acteur, sort, combattants).sort(
      (premier, second) => premier.pvActuels - second.pvActuels,
    );
    if (cibles.length) {
      return {
        sort,
        cibleRef: cibles[0].ref,
      };
    }
  }
  return null;
}
function iaSoutien(acteur, combattants) {
  // un soin lançable (PA, rechargement, limites) qui a au moins une cible
  let sortSoin = acteur.sorts
    .map((idSort) => SORTS[idSort])
    .find(
      (sort) =>
        sort.type === `soin` &&
        acteur.paActuels >= coutPA(sort, acteur) &&
        ciblesValides(acteur, sort, combattants).length > 0,
    );
  if (sortSoin) {
    let valides = new Set(ciblesValides(acteur, sortSoin, combattants).map((cible) => cible.ref));
    let blesses = alliesVivants(acteur, combattants)
      .filter((allie) => valides.has(allie.ref) && allie.pvActuels < allie.pvMax)
      .sort((premier, second) => premier.pvActuels - second.pvActuels);
    if (blesses.length) {
      return {
        sort: sortSoin,
        cibleRef: blesses[0].ref,
      };
    }
  }
  return iaAgressive(acteur, combattants);
}
export const choisirActionIA = (acteur, combattants) => {
  if (acteur.ia === `soutien`) {
    return iaSoutien(acteur, combattants);
  }
  return iaAgressive(acteur, combattants);
};
