import { EQUIPEMENTS, MONDES } from "../data/index.js";
import {
  ECONOMIE,
  RARETES,
  butinDeZone,
  indexDebutMonde,
  listerButin,
  trouverZoneDansMonde,
} from "./config.js";
import { instancierObjet, tirerObjet } from "./run.js";
export function numeroZone(e, t = MONDES) {
  let n = trouverZoneDansMonde(e, t);
  if (n) {
    return indexDebutMonde(n.tranche.id, t) + n.index + 1;
  }
  return 1;
}
export function numeroZoneObjet(e, t = MONDES) {
  for (let n of t) {
    for (let r = 0; r < n.zones.length; r++) {
      if (listerButin(butinDeZone(n.zones[r])).includes(e)) {
        return indexDebutMonde(n.id, t) + r + 1;
      }
    }
  }
  return 1;
}
export function gainKamas(e, t, n) {
  let r = ECONOMIE.gain[e] ?? 0;
  if (!r) {
    return 0;
  }
  let i = 1 + ECONOMIE.gainParToile * (t - 1);
  return Math.round(r * i * (0.85 + n() * 0.3));
}
export function ajouterKamas(e, t) {
  e.kamas += t;
  e.stats.kamasGagnes = (e.stats.kamasGagnes ?? 0) + t;
}
function prixObjet(e) {
  let t = ECONOMIE.prix[e.rarete ?? `commun`];
  let n = numeroZoneObjet(e.id);
  return Math.round(t * (1 + ECONOMIE.prixParToile * (n - 1)));
}
export const prixRevente = (e) => Math.max(1, Math.round(prixObjet(e) * ECONOMIE.tauxRevente));
export function genererStockHdv(e, t) {
  let n = trouverZoneDansMonde(e);
  let r = n ? n.tranche.zones : MONDES[0].zones;
  let i = n ? n.index : 0;
  let a = (e) => listerButin(e ? butinDeZone(e) : null);
  let o = a(r[i]);
  let s = a(r[i + 1]);
  let c = [];
  for (let e = 0; e < ECONOMIE.tailleStock; e++) {
    let e = s.length > 0 && (o.length === 0 || t() < 0.4);
    let n = e ? s : o;
    if (!n.length) {
      break;
    }
    let r = e ? [`rare`, `epique`, `legendaire`] : [`epique`, `legendaire`];
    let inst = tirerObjet(n[Math.floor(t() * n.length)], t, r);
    if (inst) {
      c.push({
        inst,
        prix: prixObjet(inst),
      });
    }
  }
  return c;
}
export function acheterObjet(e, t, n) {
  let r = t[n];
  if (!r || e.kamas < r.prix) {
    return false;
  }
  return ((e.kamas -= r.prix), e.inventaire.push(r.inst), t.splice(n, 1), true);
}
export function rareteSuivante(e) {
  let t = EQUIPEMENTS[e.id]?.tiers;
  if (!t || !e.rarete) {
    return null;
  }
  for (let n = RARETES.indexOf(e.rarete) + 1; n < RARETES.length; n++) {
    if (t[RARETES[n]]) {
      return RARETES[n];
    }
  }
  return null;
}
export function prixForge(e, t = false) {
  let rarete = rareteSuivante(e);
  if (!rarete) {
    return null;
  }
  let r = t ? ECONOMIE.forgeTemeraire.coef : ECONOMIE.forgeCoef;
  return Math.round(
    prixObjet({
      ...e,
      rarete,
    }) * r,
  );
}
export function forgerObjet(e, t, n, r) {
  let i = rareteSuivante(t);
  let a = prixForge(t, n);
  if (!i || a === null || e.kamas < a) {
    return null;
  }
  e.kamas -= a;
  if (n && r() < ECONOMIE.forgeTemeraire.pEchec) {
    return `echec`;
  }
  let o = instancierObjet(t.id, i);
  t.rarete = o.rarete;
  t.stats = o.stats;
  t.adaptatif = o.adaptatif;
  t.resistances = o.resistances;
  t.pa = o.pa;
  return `forge`;
}
export function vendreTout(e) {
  let t = 0;
  for (let n of e.inventaire) {
    t += prixRevente(n);
  }
  e.inventaire.length = 0;
  if (t) {
    ajouterKamas(e, t);
  }
  return t;
}
export function vendreObjet(e, t) {
  let n = e.inventaire[t];
  if (n) {
    return (e.inventaire.splice(t, 1), ajouterKamas(e, prixRevente(n)), true);
  }
  return false;
}
// Annule une vente : l'objet revient dans l'inventaire contre le prix touché.
export function annulerVente(e, inst, prix) {
  if (e.kamas < prix) {
    return false;
  }
  ajouterKamas(e, -prix);
  e.inventaire.push(inst);
  return true;
}
