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
export const statElement = (stats, element) => stats[STAT_PAR_ELEMENT[element]] ?? 0;
const PUISSANCE_PAR_POINT = 0.03;
export const multiplicateurStat = (points) => 1 + PUISSANCE_PAR_POINT * points;
export function nouvelleProgression() {
  return {
    niveau: 1,
    xp: 0,
  };
}
export function xpPourNiveau(niveau) {
  return 50 + (niveau - 1) * 25;
}
function coutPointStat(pointsInvestis) {
  if (pointsInvestis < SEUIL_COUT_STAT_1) {
    return 1;
  }
  if (pointsInvestis < SEUIL_COUT_STAT_2) {
    return 2;
  }
  return 3;
}
function pointsDepuisCapital(capital) {
  let points = 0;
  let reste = capital;
  while (reste >= coutPointStat(points)) {
    reste -= coutPointStat(points);
    points += 1;
  }
  return points;
}
export function statsDeNiveau(classe, progression) {
  let gains = GAINS_ARCHETYPE[classe.archetype];
  let niveauxGagnes = Math.max(0, progression.niveau - 1);
  let base = classe.stats;
  let bonusElement = (stat) => {
    if (classe.elements.some((element) => STAT_PAR_ELEMENT[element] === stat)) {
      return pointsDepuisCapital(gains.parElement * niveauxGagnes);
    }
    return 0;
  };
  let force = (base.force ?? 0) + bonusElement(`force`);
  let chance = (base.chance ?? 0) + bonusElement(`chance`);
  return {
    force,
    intelligence: (base.intelligence ?? 0) + bonusElement(`intelligence`),
    agilite: (base.agilite ?? 0) + bonusElement(`agilite`),
    chance,
    vitalite:
      (base.vitalite ?? 0) +
      pointsDepuisCapital(gains.vitalite * niveauxGagnes) +
      Math.floor(force / 5),
    prospection: (base.prospection ?? 0) + Math.floor(chance / 3),
    soin: base.soin ?? 0,
  };
}
export function gagnerXp(progression, xp, niveauMax = Infinity) {
  if (progression.niveau >= niveauMax) {
    return 0;
  }
  progression.xp += xp;
  let niveauxGagnes = 0;
  while (progression.niveau < niveauMax && progression.xp >= xpPourNiveau(progression.niveau)) {
    progression.xp -= xpPourNiveau(progression.niveau);
    progression.niveau += 1;
    niveauxGagnes += 1;
  }
  if (progression.niveau >= niveauMax) {
    progression.xp = 0;
  }
  return niveauxGagnes;
}
export function pvMaxDeNiveau(classe, progression) {
  return classe.pvBase + statsDeNiveau(classe, progression).vitalite * 1;
}
export function bonusDegatsIntelligence(stats) {
  return 1 + Math.min(0.2, stats.intelligence * 0.001);
}
// Deux sources séparées : l'élément (plafonné à +50 %) et la stat Soin (sans plafond commun).
export function multiplicateurSoin(stats, pointsElement) {
  return 1 + Math.min(0.5, pointsElement * 0.002) + (stats.soin ?? 0) * 0.005;
}
const effetsTourVides = () => ({
  soins: [],
  boucliers: [],
  degatsPct: 0,
});
const pctPvMax = (combattant, part) => Math.round(combattant.pvMax * part);
export function verifierDofusArgente(combattant, reliques) {
  (!reliques.has(`dofus_argente`) && !reliques.has(`dofus_argente_scintillant`)) ||
    combattant.argenteUtilise ||
    combattant.argenteArme !== undefined ||
    (combattant.pvActuels > 0 &&
      combattant.pvActuels < combattant.pvMax * 0.2 &&
      (combattant.argenteArme = combattant.toursJoues ?? 0));
}
export function effetsDebutTourReliques(combattant, combattants, reliques) {
  let effets = effetsTourVides();
  let tours = combattant.toursJoues ?? 0;
  if (reliques.has(`dokoko`) && tours % 2 == 0) {
    effets.soins.push({
      ref: combattant.ref,
      montant: pctPvMax(combattant, 0.1),
    });
  }
  if (reliques.has(`dofus_nebuleux`)) {
    effets.degatsPct += tours % 2 == 0 ? 0.05 : -0.05;
  }
  if (reliques.has(`dofus_sylvestre`)) {
    effets.soins.push({
      ref: combattant.ref,
      montant: pctPvMax(combattant, 0.03),
    });
  }
  if (reliques.has(`dofus_abyssal`) && combattant.position >= 4) {
    effets.boucliers.push({
      ref: combattant.ref,
      montant: pctPvMax(combattant, 0.05),
      tours: 1,
    });
  }
  if (combattant.argenteArme !== undefined && tours > combattant.argenteArme) {
    effets.soins.push({
      ref: combattant.ref,
      montant: pctPvMax(combattant, 0.2),
      argenteConsume: true,
    });
  }
  return effets;
}
// Dofus Verdoyant : bonus contre les ennemis empoisonnés ou infectés
export function multiplicateurDofusDegats(attaquant, cible, reliques) {
  if (
    reliques.has(`dofus_verdoyant`) &&
    cible.effets.some((effet) => effet.stat === `poison` || effet.stat === `infection`)
  ) {
    return 1.15;
  }
  return 1;
}
export function boucliersDorigami(combattant, reliques) {
  let effets = effetsTourVides();
  if (reliques.has(`dorigami`)) {
    effets.boucliers.push({
      ref: combattant.ref,
      montant: pctPvMax(combattant, 0.2),
      tours: 1,
    });
  }
  return effets;
}
const estDevant = (combattant) => combattant.position < 4;
const alliesVivantsDe = (combattant, combattants) =>
  combattants.filter(
    (autre) =>
      autre.pvActuels > 0 &&
      autre.camp === combattant.camp &&
      !autre.estLance &&
      !autre.estInvocation,
  );
const STATS_CARAC = [`force`, `intelligence`, `agilite`, `chance`];
export function appliquerDofusTachete(porteur, combattants, reliques) {
  if (reliques.has(`dofus_tachete`)) {
    for (let allie of alliesVivantsDe(porteur, combattants)) {
      if (
        allie.ref !== porteur.ref &&
        !allie.effets.some((effet) => effet.source === `dofus_tachete`)
      ) {
        for (let stat of STATS_CARAC) {
          allie.effets.push({
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
export function effetsFinTourReliques(combattant, combattants, reliques) {
  let effets = effetsTourVides();
  let vivants = combattants.filter((membre) => membre.pvActuels > 0);
  if (reliques.has(`dofus_emeraude`)) {
    let nbDevant = vivants.filter(
      (ennemi) => ennemi.camp !== combattant.camp && !ennemi.estLance && estDevant(ennemi),
    ).length;
    if (nbDevant > 0) {
      effets.boucliers.push({
        ref: combattant.ref,
        montant: pctPvMax(combattant, 0.03 * nbDevant),
        tours: 1,
      });
    }
  }
  if (reliques.has(`dofus_des_veilleurs`)) {
    for (let allie of alliesVivantsDe(combattant, combattants)) {
      allie.ref !== combattant.ref &&
        (estDevant(allie) !== estDevant(combattant) ||
          allie.veilleursRecuCeTour ||
          effets.soins.push({
            ref: allie.ref,
            montant: pctPvMax(combattant, 0.05),
            veilleursConsume: true,
          }));
    }
  }
  if (reliques.has(`domakuro`) && (combattant.toursJoues ?? 0) === 1 && !combattant.aFrappeCeTour) {
    combattant.degatsPctPermanent = (combattant.degatsPctPermanent ?? 0) + 0.08;
  }
  combattant.aFrappeCeTour = false;
  return effets;
}
