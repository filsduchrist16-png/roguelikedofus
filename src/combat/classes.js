// Mécaniques propres aux classes ajoutées : Sadida (infection), Osamodas et Steamer (créatures
// et tourelles qui jouent seules), Enutrof (force de l'âge), Sacrieur (souffrance, sacrifices),
// Pandawa et Zobal (états : ivresse, masques), Huppermage (marques et combinaisons élémentaires).
// Le reste du moteur appelle ces fonctions à quelques points précis (calcul des dégâts, impact
// d'un sort, fin de lancer, buffs, invocations, cibles valides).
import { CREATURES } from "../data/index.js";
import {
  appliquerEffet,
  ennemisVivants,
  etatCombatInitial,
  sommeEffets,
  vivants,
} from "./stats.js";
import { caseOpposeeLibre, soigner } from "./effets.js";
import { lancerAttaque } from "./sorts.js";

// ---------- états de classe (Pandawa, Zobal) ----------
// Bonus permanents tant que l'état est actif ; remplacés quand l'état change.
export const ETATS_CLASSE = {
  sobre: { nom: `Sobre`, icone: `🍵`, effets: [] },
  saoul: {
    nom: `Saoul`,
    icone: `🍺`,
    effets: [
      { stat: `degatsInfliges`, valeur: 0.15 },
      { stat: `resAll`, valeur: -0.1 },
    ],
  },
  intrepide: {
    nom: `Masque de l'Intrépide`,
    icone: `🛡️`,
    effets: [{ stat: `resAll`, valeur: 0.15 }],
  },
  psychopathe: {
    nom: `Masque du Psychopathe`,
    icone: `👹`,
    effets: [
      { stat: `degatsInfliges`, valeur: 0.2 },
      { stat: `resAll`, valeur: -0.1 },
    ],
  },
  pleutre: {
    nom: `Masque du Pleutre`,
    icone: `💨`,
    effets: [{ stat: `esquive`, valeur: 0.15 }],
  },
};

export function changerEtat(combattant, etat, ctx) {
  if (!ETATS_CLASSE[etat] || combattant.etatClasse === etat) {
    return false;
  }
  combattant.effets = combattant.effets.filter((e) => e.source !== `etat`);
  for (const effet of ETATS_CLASSE[etat].effets) {
    combattant.effets.push({ ...effet, toursRestants: 99, source: `etat` });
  }
  combattant.etatClasse = etat;
  ctx?.log(`${ETATS_CLASSE[etat].icone} ${combattant.nom} passe en ${ETATS_CLASSE[etat].nom}.`);
  return true;
}

// Un sort peut changer selon l'état du lanceur : `selonEtat: { saoul: { ...surcharges } }`.
export function sortSelonEtat(lanceur, sort) {
  const variante = sort.selonEtat?.[lanceur.etatClasse];
  return variante ? { ...sort, ...variante } : sort;
}

// ---------- infection (Sadida) ----------
export const estInfecte = (c) => sommeEffets(c, `infection`) > 0;
export function infecter(cible, tours, ctx) {
  if (cible.estLance || cible.estEgide) {
    return;
  }
  const deja = cible.effets.find((e) => e.stat === `infection`);
  if (deja) {
    deja.toursRestants = Math.max(deja.toursRestants, tours);
  } else {
    cible.effets.push({ stat: `infection`, valeur: 1, toursRestants: tours });
    ctx.log(`🌿 ${cible.nom} est infecté (${tours}t).`);
  }
}

// ---------- marques élémentaires (Huppermage) ----------
const NOMS_MARQUES = { feu: `Feu`, eau: `Eau`, terre: `Terre`, air: `Air` };
export const ICONES_MARQUES = { feu: `🔥`, eau: `💧`, terre: `🪨`, air: `🌪️` };

// ---------- multiplicateur de dégâts propre aux classes ----------
export function multiplicateurClasse(lanceur, sort, cible, ctx) {
  let m = 1;
  // Sacrieur : plus il est blessé, plus il frappe fort (jusqu'à +60 % à 0 PV)
  if (lanceur.souffrance && lanceur.pvMax > 0) {
    m *= 1 + 0.6 * Math.max(0, 1 - lanceur.pvActuels / lanceur.pvMax);
  }
  // Enutrof : Force de l'Âge, plus forte à chaque tour joué (plafonnée à 10 tours)
  if (sort.bonusParTourJoue) {
    m *= 1 + sort.bonusParTourJoue * Math.min(10, Math.max(0, (lanceur.toursJoues ?? 1) - 1));
  }
  // Sadida : Inoculation, plus forte par ennemi infecté
  if (sort.bonusParInfecte && ctx?.combatants) {
    m *=
      1 + sort.bonusParInfecte * ennemisVivants(lanceur, ctx.combatants).filter(estInfecte).length;
  }
  // Huppermage : Polarité consomme la marque de la cible pour frapper plus fort
  if (sort.bonusSiMarque && cible?.marqueElement) {
    m *= 1 + sort.bonusSiMarque;
  }
  // Pandawa / Zobal : variante d'un sort plus puissante dans un état donné
  if (sort.multEtat) {
    m *= sort.multEtat;
  }
  return m;
}

// ---------- effets à l'impact d'un sort sur chaque cible touchée ----------
export function effetsClasseSurCible(lanceur, sort, cible, coup, ctx) {
  if (sort.infecte) {
    infecter(cible, sort.infecte, ctx);
  }
  if (sort.desenvouteCible && cible.pvActuels > 0) {
    const avant = cible.effets.length;
    cible.effets = cible.effets.filter(
      (e) =>
        !(
          [`esquive`, `reductionDegats`, `armure`, `resAll`, `hot`].includes(e.stat) ||
          (e.stat === `degatsInfliges` && e.valeur > 0)
        ),
    );
    cible.bouclier = 0;
    if (cible.effets.length < avant) {
      ctx.log(`👻 ${cible.nom} perd ses effets bénéfiques et son bouclier.`);
    }
  }
  if (sort.consommeMarque && cible.marqueElement) {
    ctx.log(
      `✨ ${lanceur.nom} consomme la marque ${NOMS_MARQUES[cible.marqueElement]} de ${cible.nom}.`,
    );
    cible.marqueElement = undefined;
  }
  if (sort.marqueElement && cible.pvActuels > 0 && !cible.estLance) {
    const ancienne = cible.marqueElement;
    if (ancienne && ancienne !== sort.marqueElement) {
      // combinaison : un second élément réagit avec le premier
      cible.marqueElement = undefined;
      ctx.log(
        `💥 Combinaison élémentaire sur ${cible.nom} (${NOMS_MARQUES[ancienne]} + ${NOMS_MARQUES[sort.marqueElement]}) !`,
      );
      lancerAttaque(
        lanceur,
        { ...sort, sansEsquiveNiCrit: true, marqueElement: undefined, element: ancienne },
        cible,
        { useMax: false, mult: 0.6, ctx },
        `Combinaison`,
      );
    } else {
      cible.marqueElement = sort.marqueElement;
    }
  }
}

// Contagion : sur une cible infectée, le sort se propage aux autres ennemis infectés.
export function propagerInfection(lanceur, sort, cible, cs, ctx) {
  if (!sort.propageInfectes || !estInfecte(cible)) {
    return;
  }
  const autres = ennemisVivants(lanceur, cs).filter((e) => e.ref !== cible.ref && estInfecte(e));
  if (autres.length) {
    ctx.log(`🌿 La contagion se propage à ${autres.length} ennemi(s) infecté(s).`);
  }
  for (const e of autres) {
    lancerAttaque(
      lanceur,
      { ...sort, propageInfectes: false },
      e,
      { useMax: false, mult: 0.7, ctx },
      sort.nom,
    );
  }
}

// ---------- effets après le lancer (dégâts) ----------
export function effetsClasseFinLancer(lanceur, sort, cs, ctx) {
  if (sort.paImmediatLanceur) {
    lanceur.paActuels += sort.paImmediatLanceur;
    ctx.log(`${lanceur.nom} récupère ${sort.paImmediatLanceur} PA.`);
  }
  if (sort.lanceurChangeLigne) {
    const pos = caseOpposeeLibre(lanceur, cs);
    if (pos !== null) {
      lanceur.position = pos;
      ctx.log(`${lanceur.nom} bondit en ligne ${pos < 4 ? `AVANT` : `ARRIÈRE`}.`);
    }
  }
  if (sort.etatApres) {
    changerEtat(lanceur, sort.etatApres, ctx);
  }
  if (sort.boostInvocations) {
    const creatures = creaturesDe(lanceur, cs);
    for (const c of creatures) {
      appliquerEffet(c, {
        stat: `degatsInfliges`,
        valeur: sort.boostInvocations.valeur,
        duree: sort.boostInvocations.duree,
      });
    }
    if (creatures.length) {
      ctx.log(
        `🐾 Les créatures de ${lanceur.nom} s'excitent : +${Math.round(sort.boostInvocations.valeur * 100)} % de dégâts (${sort.boostInvocations.duree}t).`,
      );
    }
  }
}

// ---------- effets des sorts de soutien (buffs, soins) ----------
export function effetsClasseSoutien(sort, cible, lanceur, cs, ctx) {
  if (sort.basculeEtat) {
    const [a, b] = sort.basculeEtat;
    const suivant = lanceur.etatClasse === b ? a : b;
    changerEtat(lanceur, suivant, ctx);
    if (suivant === `sobre`) {
      lanceur.paActuels += 1;
      ctx.log(`${lanceur.nom} retrouve ses esprits : +1 PA.`);
    }
  }
  if (sort.etat) {
    changerEtat(lanceur, sort.etat, ctx);
  }
  if (sort.sacrifiePvPct) {
    const perte = Math.max(1, Math.round(lanceur.pvMax * sort.sacrifiePvPct));
    lanceur.pvActuels = Math.max(1, lanceur.pvActuels - perte);
    ctx.log(`🩸 ${lanceur.nom} sacrifie ${perte} PV.`);
  }
  if (sort.transfertPvPct && cible.ref !== lanceur.ref) {
    const montant = Math.max(1, Math.round(lanceur.pvMax * sort.transfertPvPct));
    const donne = Math.min(montant, Math.max(0, lanceur.pvActuels - 1));
    lanceur.pvActuels -= donne;
    ctx.log(`🩸 ${lanceur.nom} transfuse ${donne} PV à ${cible.nom}.`);
    soigner(cible, donne * 2, ctx);
  }
  if (sort.piqure) {
    if (cible.creature) {
      cible.paActuels += 2;
      ctx.log(`💉 ${cible.nom} est piqué au vif : +2 PA immédiatement.`);
    } else {
      cible.paBonusNextTurn += 1;
      ctx.log(`💉 ${cible.nom} recevra 1 PA de plus au prochain tour.`);
    }
  }
  if (sort.evolue) {
    if (cible.tourelle) {
      if ((cible.niveauTourelle ?? 1) < 3) {
        cible.niveauTourelle = (cible.niveauTourelle ?? 1) + 1;
        cible.degatsPctPermanent = (cible.degatsPctPermanent ?? 0) + 0.25;
        cible.multSoinCreature = (cible.multSoinCreature ?? 1) + 0.25;
        const gain = Math.round(cible.pvMax * 0.2);
        cible.pvMax += gain;
        cible.pvBase += gain;
        ctx.log(`⚙️ ${cible.nom} évolue au niveau ${cible.niveauTourelle} : +25 % d'efficacité.`);
      }
      soigner(cible, Math.round(cible.pvMax * 0.3), ctx);
    } else {
      cible.paBonusNextTurn += 1;
      ctx.log(`⚙️ ${cible.nom} recevra 1 PA de plus au prochain tour.`);
    }
  }
  if (sort.bouclierInvocationsPct && cible.ref === lanceur.ref) {
    for (const c of creaturesDe(lanceur, cs)) {
      const b = Math.round(c.pvMax * sort.bouclierInvocationsPct);
      c.bouclier += b;
      (c.boucliersTemporaires ??= []).push({ montant: b, tours: 2 });
      ctx.log(`${c.nom} gagne un bouclier de ${b}.`);
    }
  }
}

// Boîte de Pandore (Enutrof) : soigne l'équipe mais les ennemis gagnent des PA.
export function effetsClasseApresSoin(lanceur, sort, cs, ctx) {
  if (sort.paEnnemisProchainTour) {
    const servis = ennemisVivants(lanceur, cs).filter(
      () => ctx.rng() < (sort.paEnnemisChance ?? 1),
    );
    for (const e of servis) {
      e.paBonusNextTurn += sort.paEnnemisProchainTour;
    }
    if (servis.length) {
      ctx.log(
        `📦 La Boîte de Pandore s'ouvre : ${servis.map((e) => e.nom).join(`, `)} gagne${servis.length > 1 ? `nt` : ``} ${sort.paEnnemisProchainTour} PA.`,
      );
    }
  }
}

// ---------- créatures et tourelles (Osamodas, Steamer) ----------
export const creaturesDe = (lanceur, cs) =>
  vivants(cs).filter((c) => c.creature && c.invoquePar === lanceur.ref);

const refCreature = (type, lanceur) => `crea_${type}_${lanceur.ref}`;

function caseLibre(camp, cs, preferArriere) {
  const prises = new Set(
    vivants(cs)
      .filter((c) => c.camp === camp)
      .map((c) => c.position),
  );
  const ordre = preferArriere ? [4, 5, 6, 7, 0, 1, 2, 3] : [0, 1, 2, 3, 4, 5, 6, 7];
  return ordre.find((p) => !prises.has(p)) ?? null;
}

export function creatureBloquee(lanceur, sort, cs) {
  const type = sort.invoqueCreature;
  if (!type) {
    return false;
  }
  const dejaLa = vivants(cs).some((c) => c.ref === refCreature(type, lanceur));
  return dejaLa || caseLibre(lanceur.camp, cs, CREATURES[type]?.arriere) === null;
}

export function invoquerCreature(lanceur, type, cs, ctx) {
  const def = CREATURES[type];
  const ref = refCreature(type, lanceur);
  const position = caseLibre(lanceur.camp, cs, def.arriere);
  if (!def || position === null || vivants(cs).some((c) => c.ref === ref)) {
    ctx.log(`L'invocation de ${lanceur.nom} échoue (plus de place).`);
    return;
  }
  const index = cs.findIndex((c) => c.ref === ref);
  if (index >= 0) {
    cs.splice(index, 1);
  }
  const pv = Math.max(10, Math.round(lanceur.pvMax * def.pvPct));
  const stats = {};
  for (const [k, v] of Object.entries(lanceur.stats)) {
    stats[k] = Math.round((v ?? 0) * def.statsPct);
  }
  cs.push({
    ref,
    nom: def.nom,
    pvBase: pv,
    pvMax: pv,
    pvActuels: pv,
    stats,
    paMax: def.pa,
    paActuels: def.pa,
    initiative: def.initiative,
    resistances: { ...(def.resistances ?? {}) },
    sorts: [...def.sorts],
    camp: lanceur.camp,
    position,
    niveau: lanceur.niveau,
    ia: def.ia,
    img: def.img,
    elements: lanceur.elements,
    ...etatCombatInitial(),
    invoquePar: lanceur.ref,
    creature: true,
    tourelle: !!def.tourelle,
    provoque: !!def.provoque,
  });
  ctx.log(
    `🐾 ${lanceur.nom} invoque ${def.nom} (${pv} PV) en ligne ${position < 4 ? `avant` : `arrière`}.`,
  );
}

// La Gardienne soigne mieux après une Évolution.
export const multiplicateurSoinCreature = (c) => c.multSoinCreature ?? 1;

// Cibles valides : règles propres aux nouvelles classes.
export function sortIndisponible(lanceur, sort, cs) {
  return creatureBloquee(lanceur, sort, cs);
}
export function filtrerCiblesClasse(lanceur, sort, cibles) {
  if (sort.transfertPvPct) {
    return cibles.filter((c) => c.ref !== lanceur.ref);
  }
  return cibles;
}
