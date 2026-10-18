// Almanax du jour (inspiré de l'Almanax de DOFUS) : une petite quête quotidienne, la même pour tout le
// monde un jour donné (date locale, aucune donnée en ligne), suivie pendant les runs (hors Songes).
// Accomplie, elle met de côté une récompense modeste pour la prochaine run : des kamas de départ ou
// une relique de run commune. Logique pure : le déroulé appelle `progresserAlmanax`.
import { dateDuJour, graineDeTexte, rngGraine } from "./runDuJour.js";

const NOMS_ELEMENTS = { terre: `Terre`, feu: `Feu`, eau: `Eau`, air: `Air` };
const ICONES_ELEMENTS = { terre: `🪨`, feu: `🔥`, eau: `💧`, air: `🌪️` };
const combatGagne = (evenement) => evenement.type === `combat` && evenement.gagne;
/**
 * Quêtes possibles : `compte(evenement)` dit de combien l'évènement fait avancer la quête.
 * Évènements : `combat` (résumé du combat : gagne, herosKO, noeud, rondes, defiOk, coups),
 * `zone` (zone terminée), `camp` (halte au camp), `coffre` (coffre ouvert).
 */
export const QUETES_ALMANAX = [
  {
    id: `sans_ko`,
    icone: `🛡️`,
    texte: `Gagne 3 combats sans qu'aucun héros tombe`,
    objectif: 3,
    compte: (evenement) => (combatGagne(evenement) && !evenement.herosKO ? 1 : 0),
  },
  {
    id: `elites`,
    icone: `💀`,
    texte: `Bats 2 combats durs`,
    objectif: 2,
    compte: (evenement) => (combatGagne(evenement) && evenement.noeud === `combat_dur` ? 1 : 0),
  },
  {
    id: `boss`,
    icone: `🐉`,
    texte: `Bats le boss d'un donjon`,
    objectif: 1,
    compte: (evenement) => (combatGagne(evenement) && evenement.noeud === `donjon` ? 1 : 0),
  },
  {
    id: `eclair`,
    icone: `⚡`,
    texte: `Gagne 2 combats en 3 rondes ou moins`,
    objectif: 2,
    compte: (evenement) => (combatGagne(evenement) && evenement.rondes <= 3 ? 1 : 0),
  },
  {
    id: `defis`,
    icone: `🎯`,
    texte: `Réussis 3 défis de combat`,
    objectif: 3,
    compte: (evenement) => (combatGagne(evenement) && evenement.defiOk ? 1 : 0),
  },
  ...Object.keys(NOMS_ELEMENTS).map((element) => ({
    id: `coups_${element}`,
    icone: ICONES_ELEMENTS[element],
    texte: `Touche 15 fois un ennemi avec des dégâts ${[`eau`, `air`].includes(element) ? `d'` : `de `}${NOMS_ELEMENTS[element]}`,
    objectif: 15,
    compte: (evenement) =>
      evenement.type === `combat` ? Math.max(0, Math.floor(evenement.coups?.[element] ?? 0)) : 0,
  })),
  {
    id: `zones`,
    icone: `🗺️`,
    texte: `Termine 2 zones`,
    objectif: 2,
    compte: (evenement) => (evenement.type === `zone` ? 1 : 0),
  },
  {
    id: `coffres`,
    icone: `🧰`,
    texte: `Ouvre 2 coffres de la carte`,
    objectif: 2,
    compte: (evenement) => (evenement.type === `coffre` ? 1 : 0),
  },
  {
    id: `camps`,
    icone: `⛺`,
    texte: `Fais halte dans 2 camps de repos`,
    objectif: 2,
    compte: (evenement) => (evenement.type === `camp` ? 1 : 0),
  },
];
const QUETE_PAR_ID = Object.fromEntries(QUETES_ALMANAX.map((quete) => [quete.id, quete]));
// Kamas de départ : multiple du gain d'un combat dur de la première zone du monde de la run.
export const KAMAS_ALMANAX = 3;

/** Quête du jour (même pour tous à une date donnée). */
export function queteDuJour(date = dateDuJour()) {
  const rng = rngGraine(graineDeTexte(`almanax:${date}`));
  return QUETES_ALMANAX[Math.floor(rng() * QUETES_ALMANAX.length)];
}
/** Récompense du jour : `kamas` ou `relique` (une relique de run commune). */
export function recompenseDuJour(date = dateDuJour()) {
  const rng = rngGraine(graineDeTexte(`almanax-recompense:${date}`));
  return rng() < 0.5 ? `kamas` : `relique`;
}
export const TEXTES_RECOMPENSE = {
  kamas: `des kamas de départ pour ta prochaine run`,
  relique: `une relique de run commune au départ de ta prochaine run`,
};
/** État de l'Almanax pour `date` : celui de la méta s'il est du jour, sinon une quête neuve. */
export function etatAlmanax(meta, date = dateDuJour()) {
  const almanax = meta?.almanax;
  const quete = queteDuJour(date);
  const duJour = almanax?.date === date;
  return {
    date,
    quete,
    progres: duJour ? Math.min(quete.objectif, almanax.progres ?? 0) : 0,
    fait: duJour && !!almanax.fait,
    recompense: recompenseDuJour(date),
    enAttente: almanax?.enAttente ?? null,
  };
}
/**
 * Fait avancer la quête du jour avec un évènement de run. Met `meta.almanax` à jour.
 * Renvoie { change, accompli } (accompli : la quête vient d'être terminée).
 */
export function progresserAlmanax(meta, evenement, date = dateDuJour()) {
  const etat = etatAlmanax(meta, date);
  if (etat.fait) {
    return { change: false, accompli: false };
  }
  const pas = etat.quete.compte(evenement ?? {});
  if (!(pas > 0)) {
    return { change: false, accompli: false };
  }
  const progres = Math.min(etat.quete.objectif, etat.progres + pas);
  const accompli = progres >= etat.quete.objectif;
  meta.almanax = {
    date,
    progres,
    fait: accompli,
    // une récompense non utilisée est remplacée par la nouvelle
    enAttente: accompli ? { type: etat.recompense, date } : etat.enAttente,
  };
  return { change: true, accompli };
}
/** Retire la récompense en attente (au départ d'une run) et la renvoie, ou null. */
export function prendreRecompenseAlmanax(meta) {
  const enAttente = meta?.almanax?.enAttente;
  if (!enAttente) {
    return null;
  }
  meta.almanax = { ...meta.almanax, enAttente: null };
  return enAttente;
}
/** Lecture d'une sauvegarde : champs abîmés oubliés (pas d'Almanax = aucun progrès). */
export function normaliserAlmanax(almanax) {
  if (!almanax || typeof almanax !== `object` || Array.isArray(almanax)) {
    return undefined;
  }
  const date = typeof almanax.date === `string` && /^\d{4}-\d{2}-\d{2}$/.test(almanax.date);
  const enAttente =
    almanax.enAttente &&
    typeof almanax.enAttente === `object` &&
    TEXTES_RECOMPENSE[almanax.enAttente.type]
      ? {
          type: almanax.enAttente.type,
          date: typeof almanax.enAttente.date === `string` ? almanax.enAttente.date : ``,
        }
      : null;
  if (!date) {
    return enAttente ? { date: ``, progres: 0, fait: false, enAttente } : undefined;
  }
  return {
    date: almanax.date,
    progres: Number.isFinite(almanax.progres) ? Math.max(0, Math.floor(almanax.progres)) : 0,
    fait: !!almanax.fait,
    enAttente,
  };
}
/** Une quête est-elle connue (utile aux tests) ? */
export const queteAlmanaxConnue = (id) => !!QUETE_PAR_ID[id];
/** « 18 octobre » : date lisible d'un AAAA-MM-JJ. */
export function dateLisible(date) {
  const [annee, mois, jour] = String(date).split(`-`).map(Number);
  const MOIS = [
    `janvier`,
    `février`,
    `mars`,
    `avril`,
    `mai`,
    `juin`,
    `juillet`,
    `août`,
    `septembre`,
    `octobre`,
    `novembre`,
    `décembre`,
  ];
  return annee && MOIS[mois - 1] ? `${jour === 1 ? `1er` : jour} ${MOIS[mois - 1]}` : String(date);
}
/** Pastille de la carte : la quête du jour et son progrès (vide une fois accomplie). */
export function effetAlmanax(meta, date = dateDuJour()) {
  const etat = etatAlmanax(meta, date);
  if (etat.fait) {
    return [];
  }
  return [
    {
      icone: `📅`,
      nom: `Almanax ${etat.progres}/${etat.quete.objectif}`,
      desc: `Almanax du ${dateLisible(date)} : ${etat.quete.texte} (${etat.progres}/${etat.quete.objectif}). Récompense : ${TEXTES_RECOMPENSE[etat.recompense]}.`,
    },
  ];
}
