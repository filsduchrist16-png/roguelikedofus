const SEUIL_COUT_STAT_1 = 200;
const SEUIL_COUT_STAT_2 = 300;
export const GAINS_ARCHETYPE = {
  melee: {
    parElement: 3,
    vitalite: 2,
  },
  distance: {
    parElement: 4,
    vitalite: 1,
  },
};
export const STAT_PAR_ELEMENT = {
  terre: `force`,
  feu: `intelligence`,
  air: `agilite`,
  eau: `chance`,
};
export const statElement = (e, t) => e[STAT_PAR_ELEMENT[t]] ?? 0;
const PUISSANCE_PAR_POINT = 0.03;
export const multiplicateurStat = (e) => 1 + PUISSANCE_PAR_POINT * e;
export function nouvelleProgression() {
  return {
    niveau: 1,
    xp: 0,
  };
}
export function xpPourNiveau(e) {
  return 50 + (e - 1) * 25;
}
function coutPointStat(e) {
  if (e < SEUIL_COUT_STAT_1) {
    return 1;
  }
  if (e < SEUIL_COUT_STAT_2) {
    return 2;
  }
  return 3;
}
function pointsDepuisCapital(e) {
  let t = 0;
  let n = e;
  while (n >= coutPointStat(t)) {
    n -= coutPointStat(t);
    t += 1;
  }
  return t;
}
export function statsDeNiveau(e, t) {
  let n = GAINS_ARCHETYPE[e.archetype];
  let r = Math.max(0, t.niveau - 1);
  let e_stats = e.stats;
  let a = (t) => {
    if (e.elements.some((e) => STAT_PAR_ELEMENT[e] === t)) {
      return pointsDepuisCapital(n.parElement * r);
    }
    return 0;
  };
  let force = (e_stats.force ?? 0) + a(`force`);
  let chance = (e_stats.chance ?? 0) + a(`chance`);
  return {
    force,
    intelligence: (e_stats.intelligence ?? 0) + a(`intelligence`),
    agilite: (e_stats.agilite ?? 0) + a(`agilite`),
    chance,
    vitalite: (e_stats.vitalite ?? 0) + pointsDepuisCapital(n.vitalite * r) + Math.floor(force / 5),
    prospection: (e_stats.prospection ?? 0) + Math.floor(chance / 3),
    soin: e_stats.soin ?? 0,
  };
}
export function gagnerXp(e, t, n = Infinity) {
  if (e.niveau >= n) {
    return 0;
  }
  e.xp += t;
  let r = 0;
  while (e.niveau < n && e.xp >= xpPourNiveau(e.niveau)) {
    e.xp -= xpPourNiveau(e.niveau);
    e.niveau += 1;
    r += 1;
  }
  if (e.niveau >= n) {
    e.xp = 0;
  }
  return r;
}
export function pvMaxDeNiveau(e, t) {
  return e.pvBase + statsDeNiveau(e, t).vitalite * 1;
}
export function bonusDegatsIntelligence(e) {
  return 1 + Math.min(0.2, e.intelligence * 0.001);
}
// Deux sources séparées : l'élément (plafonné à +50 %) et la stat Soin (sans plafond commun).
export function multiplicateurSoin(e, t) {
  return 1 + Math.min(0.5, t * 0.002) + (e.soin ?? 0) * 0.005;
}
const effetsTourVides = () => ({
  soins: [],
  boucliers: [],
  degatsPct: 0,
});
const pctPvMax = (e, t) => Math.round(e.pvMax * t);
export function verifierDofusArgente(e, t) {
  (!t.has(`dofus_argente`) && !t.has(`dofus_argente_scintillant`)) ||
    e.argenteUtilise ||
    e.argenteArme !== undefined ||
    (e.pvActuels > 0 && e.pvActuels < e.pvMax * 0.2 && (e.argenteArme = e.toursJoues ?? 0));
}
export function effetsDebutTourReliques(e, t, n) {
  let r = effetsTourVides();
  let i = e.toursJoues ?? 0;
  if (n.has(`dokoko`) && i % 2 == 0) {
    r.soins.push({
      ref: e.ref,
      montant: pctPvMax(e, 0.1),
    });
  }
  if (n.has(`dofus_nebuleux`)) {
    r.degatsPct += i % 2 == 0 ? 0.05 : -0.05;
  }
  if (n.has(`dofus_sylvestre`)) {
    r.soins.push({
      ref: e.ref,
      montant: pctPvMax(e, 0.03),
    });
  }
  if (n.has(`dofus_abyssal`) && e.position >= 4) {
    r.boucliers.push({
      ref: e.ref,
      montant: pctPvMax(e, 0.05),
      tours: 1,
    });
  }
  if (e.argenteArme !== undefined && i > e.argenteArme) {
    r.soins.push({
      ref: e.ref,
      montant: pctPvMax(e, 0.2),
      argenteConsume: true,
    });
  }
  return r;
}
// Dofus Verdoyant : bonus contre les ennemis empoisonnés ou infectés
export function multiplicateurDofusDegats(attaquant, cible, reliques) {
  if (
    reliques.has(`dofus_verdoyant`) &&
    cible.effets.some((x) => x.stat === `poison` || x.stat === `infection`)
  ) {
    return 1.15;
  }
  return 1;
}
export function boucliersDorigami(e, t) {
  let n = effetsTourVides();
  if (t.has(`dorigami`)) {
    n.boucliers.push({
      ref: e.ref,
      montant: pctPvMax(e, 0.2),
      tours: 1,
    });
  }
  return n;
}
const estDevant = (e) => e.position < 4;
const alliesVivantsDe = (e, t) =>
  t.filter((t) => t.pvActuels > 0 && t.camp === e.camp && !t.estLance && !t.estInvocation);
const STATS_CARAC = [`force`, `intelligence`, `agilite`, `chance`];
export function appliquerDofusTachete(e, t, n) {
  if (n.has(`dofus_tachete`)) {
    for (let n of alliesVivantsDe(e, t)) {
      if (n.ref !== e.ref && !n.effets.some((e) => e.source === `dofus_tachete`)) {
        for (let stat of STATS_CARAC) {
          n.effets.push({
            stat,
            valeur: 5,
            toursRestants: 1,
            source: `dofus_tachete`,
          });
        }
      }
    }
  }
}
export function effetsFinTourReliques(e, t, n) {
  let r = effetsTourVides();
  let i = t.filter((e) => e.pvActuels > 0);
  if (n.has(`dofus_emeraude`)) {
    let t = i.filter((t) => t.camp !== e.camp && !t.estLance && estDevant(t)).length;
    if (t > 0) {
      r.boucliers.push({
        ref: e.ref,
        montant: pctPvMax(e, 0.03 * t),
        tours: 1,
      });
    }
  }
  if (n.has(`dofus_des_veilleurs`)) {
    for (let n of alliesVivantsDe(e, t)) {
      n.ref !== e.ref &&
        (estDevant(n) !== estDevant(e) ||
          n.veilleursRecuCeTour ||
          r.soins.push({
            ref: n.ref,
            montant: pctPvMax(e, 0.05),
            veilleursConsume: true,
          }));
    }
  }
  if (n.has(`domakuro`) && (e.toursJoues ?? 0) === 1 && !e.aFrappeCeTour) {
    e.degatsPctPermanent = (e.degatsPctPermanent ?? 0) + 0.01;
  }
  e.aFrappeCeTour = false;
  return r;
}
