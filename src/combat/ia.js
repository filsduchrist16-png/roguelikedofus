import { SORTS } from "../data/index.js";
import { alliesVivants, ciblesValides, coutPA } from "./stats.js";
import { peutInvoquer } from "./effets.js";
function iaAgressive(e, t) {
  let n = e.sorts
    .map((e) => SORTS[e])
    .find(
      (n) =>
        n.type === `invocation` &&
        e.paActuels >= coutPA(n, e) &&
        ciblesValides(e, n, t).length > 0 &&
        peutInvoquer(e, n, t),
    );
  if (n) {
    return {
      sort: n,
      cibleRef: e.ref,
    };
  }
  let r = e.sorts
    .map((e) => SORTS[e])
    .filter((t) => t.type === `degats` && e.paActuels >= coutPA(t, e))
    .sort((t, n) => coutPA(n, e) - coutPA(t, e));
  for (let n of r) {
    let r = ciblesValides(e, n, t).sort((e, t) => e.pvActuels - t.pvActuels);
    if (r.length) {
      return {
        sort: n,
        cibleRef: r[0].ref,
      };
    }
  }
  return null;
}
function iaSoutien(e, t) {
  // un soin lançable (PA, rechargement, limites) qui a au moins une cible
  let n = e.sorts
    .map((e) => SORTS[e])
    .find(
      (n) => n.type === `soin` && e.paActuels >= coutPA(n, e) && ciblesValides(e, n, t).length > 0,
    );
  if (n) {
    let valides = new Set(ciblesValides(e, n, t).map((c) => c.ref));
    let r = alliesVivants(e, t)
      .filter((e) => valides.has(e.ref) && e.pvActuels < e.pvMax)
      .sort((e, t) => e.pvActuels - t.pvActuels);
    if (r.length) {
      return {
        sort: n,
        cibleRef: r[0].ref,
      };
    }
  }
  return iaAgressive(e, t);
}
export const choisirActionIA = (e, t) => {
  if (e.ia === `soutien`) {
    return iaSoutien(e, t);
  }
  return iaAgressive(e, t);
};
