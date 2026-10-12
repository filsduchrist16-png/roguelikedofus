import { EQUIPEMENTS, MONDES, SECRETS } from "../data/index.js";
import {
  ECONOMIE,
  RARETES,
  butinDeZone,
  indexDebutMonde,
  listerButin,
  trouverZoneDansMonde,
} from "./config.js";
import { instancierObjet, tirerObjet } from "./run.js";
export function numeroZone(zoneId, mondes = MONDES) {
  let trouve = trouverZoneDansMonde(zoneId, mondes);
  if (trouve) {
    return indexDebutMonde(trouve.tranche.id, mondes) + trouve.index + 1;
  }
  return 1;
}
// Le Tier d'un objet ne change pas en cours de partie : on le garde en mémoire.
const cacheTier = new Map();
export function numeroZoneObjet(objetId, mondes = MONDES) {
  if (mondes !== MONDES) {
    return calculerTier(objetId, mondes);
  }
  if (!cacheTier.has(objetId)) {
    cacheTier.set(objetId, calculerTier(objetId, mondes));
  }
  return cacheTier.get(objetId);
}
function calculerTier(objetId, mondes) {
  for (let monde of mondes) {
    for (let indice = 0; indice < monde.zones.length; indice++) {
      if (listerButin(butinDeZone(monde.zones[indice])).includes(objetId)) {
        return indexDebutMonde(monde.id, mondes) + indice + 1;
      }
    }
    // butin d'un donjon secret : estimé comme un objet de la 10e zone du monde
    if (SECRETS[monde.id]?.butin.includes(objetId)) {
      return indexDebutMonde(monde.id, mondes) + Math.min(10, monde.zones.length);
    }
  }
  // objet retiré du butin (ancienne version) : sa toile d'origine
  return EQUIPEMENTS[objetId]?.toile ?? 1;
}
export function gainKamas(type, numZone, rng) {
  let gain = ECONOMIE.gain[type] ?? 0;
  if (!gain) {
    return 0;
  }
  let facteur = 1 + ECONOMIE.gainParToile * (numZone - 1);
  return Math.round(gain * facteur * (0.85 + rng() * 0.3));
}
export function ajouterKamas(run, montant) {
  run.kamas += montant;
  run.stats.kamasGagnes = (run.stats.kamasGagnes ?? 0) + montant;
}
function prixObjet(objet) {
  let prixBase = ECONOMIE.prix[objet.rarete ?? `commun`];
  let numZone = numeroZoneObjet(objet.id);
  return Math.round(prixBase * (1 + ECONOMIE.prixParToile * (numZone - 1)));
}
export const prixRevente = (objet) =>
  Math.max(1, Math.round(prixObjet(objet) * ECONOMIE.tauxRevente));
export function genererStockHdv(zoneId, rng) {
  let trouve = trouverZoneDansMonde(zoneId);
  let zones = trouve ? trouve.tranche.zones : MONDES[0].zones;
  let indice = trouve ? trouve.index : 0;
  // sans doublon : une pièce de boss recopiée dans les élites ne doit pas peser double
  let butinUnique = (idZone) => [...new Set(listerButin(idZone ? butinDeZone(idZone) : null))];
  let butinActuel = butinUnique(zones[indice]);
  let butinSuivant = butinUnique(zones[indice + 1]);
  let stock = [];
  for (let tirage = 0; tirage < ECONOMIE.tailleStock; tirage++) {
    let depuisSuivante = butinSuivant.length > 0 && (butinActuel.length === 0 || rng() < 0.4);
    let sources = depuisSuivante ? butinSuivant : butinActuel;
    if (!sources.length) {
      break;
    }
    let raretes = depuisSuivante ? [`rare`, `epique`, `legendaire`] : [`epique`, `legendaire`];
    let inst = tirerObjet(sources[Math.floor(rng() * sources.length)], rng, raretes);
    if (inst) {
      stock.push({
        inst,
        prix: prixObjet(inst),
      });
    }
  }
  return stock;
}
export function acheterObjet(run, stock, index) {
  let offre = stock[index];
  if (!offre || run.kamas < offre.prix) {
    return false;
  }
  return ((run.kamas -= offre.prix), run.inventaire.push(offre.inst), stock.splice(index, 1), true);
}
export function rareteSuivante(objet) {
  let tiers = EQUIPEMENTS[objet.id]?.tiers;
  if (!tiers || !objet.rarete) {
    return null;
  }
  for (let indice = RARETES.indexOf(objet.rarete) + 1; indice < RARETES.length; indice++) {
    if (tiers[RARETES[indice]]) {
      return RARETES[indice];
    }
  }
  return null;
}
export function prixForge(objet, temeraire = false) {
  let rarete = rareteSuivante(objet);
  if (!rarete) {
    return null;
  }
  let coef = temeraire ? ECONOMIE.forgeTemeraire.coef : ECONOMIE.forgeCoef;
  return Math.round(
    prixObjet({
      ...objet,
      rarete,
    }) * coef,
  );
}
export function forgerObjet(run, objet, temeraire, rng) {
  let suivante = rareteSuivante(objet);
  let prix = prixForge(objet, temeraire);
  if (!suivante || prix === null || run.kamas < prix) {
    return null;
  }
  run.kamas -= prix;
  if (temeraire && rng() < ECONOMIE.forgeTemeraire.pEchec) {
    return `echec`;
  }
  let neuf = instancierObjet(objet.id, suivante);
  objet.rarete = neuf.rarete;
  objet.stats = neuf.stats;
  objet.adaptatif = neuf.adaptatif;
  objet.resistances = neuf.resistances;
  objet.pa = neuf.pa;
  return `forge`;
}
export function vendreTout(run) {
  let total = 0;
  for (let objet of run.inventaire) {
    total += prixRevente(objet);
  }
  run.inventaire.length = 0;
  if (total) {
    ajouterKamas(run, total);
  }
  return total;
}
export function vendreObjet(run, index) {
  let objet = run.inventaire[index];
  if (objet) {
    return (run.inventaire.splice(index, 1), ajouterKamas(run, prixRevente(objet)), true);
  }
  return false;
}
// Annule une vente : l'objet revient dans l'inventaire contre le prix touché.
export function annulerVente(run, inst, prix) {
  if (run.kamas < prix) {
    return false;
  }
  ajouterKamas(run, -prix);
  run.inventaire.push(inst);
  return true;
}
// Annule plusieurs ventes d'un coup (« Vendre l'inutile ») : tout ou rien.
export function annulerVentes(run, ventes) {
  const total = ventes.reduce((somme, vente) => somme + vente.prix, 0);
  if (!ventes.length || run.kamas < total) {
    return false;
  }
  ajouterKamas(run, -total);
  run.inventaire.push(...ventes.map((vente) => vente.inst));
  return true;
}
// Annule un achat : remboursé à 100 %, l'objet retourne dans le stock, à sa place.
export function annulerAchat(run, stock, inst, prix, index) {
  const indice = run.inventaire.indexOf(inst);
  if (indice < 0) {
    return false;
  }
  run.inventaire.splice(indice, 1);
  run.kamas += prix;
  stock.splice(Math.min(Math.max(0, index), stock.length), 0, { inst, prix });
  return true;
}
