import {
  effetsClasseApresSoin,
  effetsClasseFinLancer,
  effetsClasseSoutien,
  effetsClasseSurCible,
  invoquerCreature,
  multiplicateurSoinCreature,
  propagerInfection,
  sortSelonEtat,
} from "./classes.js";
import { SORTS } from "../data/index.js";
import { appliquerDofusTachete } from "../jeu/progression.js";
import {
  alliesVivants,
  appliquerEffet,
  appliquerPoison,
  bonusConjuration,
  bonusPortails,
  calculerDegats,
  calculerDegatsDetail,
  chanceCritique,
  ciblesTouchees,
  coutPA,
  desenvouter,
  enLigneAvant,
  ennemisVivants,
  gagnerRage,
  logDegats,
  multiplicateurRelance,
  multiplicateurSoinDe,
  ouvrirPortail,
  poserBombe,
  poserTelefrag,
  reliquesActivesDe,
  sommeEffets,
  statsEffectives,
  tirageEntier,
  trouverParRef,
  vivants,
} from "./stats.js";
import {
  aBonusSiCrit,
  allieDerriere,
  appliquerSoutien,
  bouclierGroupe,
  brumeRangee,
  buffRangee,
  caseOpposeeLibre,
  ciblesBouclierGroupe,
  ciblesSoutien,
  consommerMaxRoll,
  descriptionBuff,
  infligerDegats,
  invoquerEgide,
  invoquerMonstre,
  invoquerPoupee,
  planterLance,
  plusProches,
  repousser,
  ressusciterAllie,
  retirerPA,
  soigner,
  soignerPlusBlesse,
} from "./effets.js";
export function lancerAttaque(lanceur, sort, cible, options, libelle) {
  let detail = calculerDegatsDetail(lanceur, sort, cible, options);
  if (detail.esquive) {
    return (
      options.ctx.log(`${cible.nom} esquive ${libelle} !`),
      options.ctx.fx?.({
        type: `esquive`,
        ref: cible.ref,
      }),
      0
    );
  }
  return (
    detail.crit &&
      options.ctx.fx?.({
        type: `crit`,
        ref: cible.ref,
      }),
    infligerDegats(cible, detail.dmg, lanceur, options.ctx, undefined, undefined, detail.element),
    cible.estLance ||
      logDegats(
        options.ctx,
        `${lanceur.nom} → ${libelle} sur ${cible.nom} : `,
        detail.dmg,
        detail.element,
        `${detail.crit ? ` (CRIT)` : ``}.${cible.pvActuels <= 0 ? ` ${cible.nom} est K.O. !` : ``}`,
      ),
    detail.dmg
  );
}
export function declencherPiege(cible, combattants, contexte) {
  let trouve = null;
  for (let poseurCandidat of combattants) {
    if (!poseurCandidat.pieges?.length) {
      continue;
    }
    let indexCandidat = poseurCandidat.pieges.findIndex(
      (piege) => piege.camp === cible.camp && piege.avant === enLigneAvant(cible),
    );
    if (indexCandidat >= 0) {
      trouve = {
        poseur: poseurCandidat,
        index: indexCandidat,
      };
      break;
    }
  }
  if (!trouve) {
    return;
  }
  let { poseur, index } = trouve;
  let sortPiege = SORTS[poseur.pieges[index].sortId];
  if (!sortPiege) {
    return;
  }
  poseur.pieges.splice(index, 1);
  contexte.log(`💥 Le piège de ${poseur.nom} se déclenche sur ${cible.nom} !`);
  let mult =
    bonusPortails(poseur, combattants) *
    bonusConjuration(poseur, cible, combattants) *
    (1 + sommeEffets(poseur, `bonusPieges`));
  if (sortPiege.bonusParEnnemiLigneCible) {
    mult *=
      1 +
      sortPiege.bonusParEnnemiLigneCible *
        ennemisVivants(poseur, combattants).filter(
          (ennemi) =>
            ennemi.ref !== cible.ref &&
            !ennemi.estLance &&
            enLigneAvant(ennemi) === enLigneAvant(cible),
        ).length;
  }
  let touchees = ciblesTouchees(poseur, sortPiege, cible, combattants);
  for (let touchee of touchees) {
    let eclaboussure = !!sortPiege.ratioLigne && touchee.ref !== cible.ref;
    let ratio = eclaboussure ? sortPiege.ratioLigne : 1;
    let libelle = eclaboussure
      ? `${sortPiege.nom} (piège, éclaboussure)`
      : `${sortPiege.nom} (piège)`;
    lancerAttaque(
      poseur,
      sortPiege,
      touchee,
      {
        useMax: false,
        mult: mult * ratio,
        ctx: contexte,
      },
      libelle,
    );
  }
  poseur.chausseTrappe = Math.min(5, (poseur.chausseTrappe ?? 0) + 1);
}
function declencherKaboom(lanceur, sort, combattants, ctx) {
  let victimes = new Set();
  let mult = bonusPortails(lanceur, combattants);
  for (let cible of ennemisVivants(lanceur, combattants).filter(
    (ennemi) => (ennemi.bombes ?? 0) > 0,
  )) {
    let nbBombes = cible.bombes ?? 0;
    let voisins = ennemisVivants(lanceur, combattants).filter(
      (ennemi) => ennemi.ref !== cible.ref && enLigneAvant(ennemi) === enLigneAvant(cible),
    );
    for (let indiceBombe = 0; indiceBombe < nbBombes && cible.pvActuels > 0; indiceBombe++) {
      if (
        lancerAttaque(
          lanceur,
          sort,
          cible,
          {
            useMax: false,
            mult: mult * bonusConjuration(lanceur, cible, combattants),
            ctx,
          },
          sort.nom,
        ) > 0 &&
        !cible.estLance
      ) {
        victimes.add(cible.ref);
      }
      for (let voisin of voisins) {
        voisin.pvActuels <= 0 ||
          (lancerAttaque(
            lanceur,
            sort,
            voisin,
            {
              useMax: false,
              mult: 0.5 * mult * bonusConjuration(lanceur, voisin, combattants),
              ctx,
            },
            sort.nom,
          ) > 0 &&
            !voisin.estLance &&
            victimes.add(voisin.ref));
      }
    }
  }
  if (lanceur.resquilleActive) {
    for (let ref of victimes) {
      let victime = trouverParRef(combattants, ref);
      if (victime && victime.pvActuels > 0) {
        retirerPA(victime, lanceur.resquilleActive, ctx);
      }
    }
  }
  lanceur.resquilleActive = undefined;
  for (let combattant of combattants) {
    combattant.bombes = 0;
  }
}
function resoudreFlecheEnflammee(lanceur, sort, cible, combattants, ctx, paAvant) {
  ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
  let attaque = {
    baseMin: sort.baseMin,
    baseMax: sort.baseMax,
  };
  let mult = bonusPortails(lanceur, combattants);
  let options = {
    useMax: false,
    mult: mult * bonusConjuration(lanceur, cible, combattants),
    ctx,
    paAvant,
  };
  lancerAttaque(lanceur, attaque, cible, options, sort.nom);
  if (enLigneAvant(cible)) {
    let arriere = ennemisVivants(lanceur, combattants).filter((ennemi) => !enLigneAvant(ennemi));
    for (let victime of plusProches(cible, arriere, 2)) {
      lancerAttaque(
        lanceur,
        attaque,
        victime,
        {
          ...options,
          mult: 0.5 * mult * bonusConjuration(lanceur, victime, combattants),
        },
        `${sort.nom} (éclaboussure)`,
      );
    }
  } else {
    let autres = ennemisVivants(lanceur, combattants).filter(
      (ennemi) => ennemi.ref !== cible.ref && !enLigneAvant(ennemi),
    );
    for (let victime of plusProches(cible, autres, 2)) {
      lancerAttaque(
        lanceur,
        attaque,
        victime,
        {
          ...options,
          mult: mult * bonusConjuration(lanceur, victime, combattants),
        },
        `${sort.nom} (éclaboussure)`,
      );
    }
  }
}
function resoudreDegatsPoussee(lanceur, sort, cible, combattants, ctx, paAvant) {
  ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
  let attaque = {
    baseMin: sort.baseMin,
    baseMax: sort.baseMax,
    ignoreResistances: true,
  };
  let mult = bonusPortails(lanceur, combattants);
  let options = (cibleVisee) => ({
    useMax: false,
    mult: mult * bonusConjuration(lanceur, cibleVisee, combattants),
    ctx,
    paAvant,
  });
  let voisins = vivants(combattants).filter(
    (combattant) =>
      combattant.camp === cible.camp &&
      combattant.ref !== cible.ref &&
      enLigneAvant(combattant) === enLigneAvant(cible),
  );
  if (voisins.length > 0) {
    let voisin = plusProches(cible, voisins, 1)[0];
    lancerAttaque(lanceur, attaque, cible, options(cible), `${sort.nom} (bousculade)`);
    lancerAttaque(lanceur, attaque, voisin, options(voisin), `${sort.nom} (bousculade)`);
    return;
  }
  let derriere = vivants(combattants).filter(
    (combattant) =>
      combattant.camp === cible.camp && combattant.ref !== cible.ref && !enLigneAvant(combattant),
  );
  let n_position = cible.position;
  repousser(cible, `arriere`, combattants, ctx);
  if (cible.position === n_position || cible.pvActuels <= 0) {
    return;
  }
  let voisinArriere = plusProches(cible, derriere, 1)[0];
  if (voisinArriere) {
    lancerAttaque(lanceur, attaque, cible, options(cible), `${sort.nom} (bousculade)`);
    lancerAttaque(
      lanceur,
      attaque,
      voisinArriere,
      options(voisinArriere),
      `${sort.nom} (bousculade)`,
    );
  }
}
function preparerLancer(lanceur, sort, cibleRef, cs, contexte) {
  contexte.combatants = cs;
  let paAvant = lanceur.paActuels + coutPA(sort, lanceur);
  let cible = trouverParRef(cs, cibleRef);
  let multEscalade = multiplicateurRelance(sort, lanceur);
  if (sort.maxParTour || sort.maxParCibleParTour || sort.bonusParRelanceCeTour) {
    let lancers = (lanceur.lancersCeTour ??= {});
    lancers[sort.id] = (lancers[sort.id] ?? 0) + 1;
    if (cibleRef) {
      lancers[`${sort.id}:${cibleRef}`] = (lancers[`${sort.id}:${cibleRef}`] ?? 0) + 1;
    }
  }
  if (sort.bonusParLancerCombat) {
    let lancersCombat = (lanceur.lancersCombat ??= {});
    lancersCombat[sort.id] = (lancersCombat[sort.id] ?? 0) + 1;
  }
  return {
    lanceur,
    sort,
    cibleRef,
    cible,
    cs,
    ctx: contexte,
    paAvant,
    multEscalade,
    poseCooldown: (cibleTouchee) => {
      let poser = (cle, duree) => {
        lanceur.cooldowns[cle] = duree;
        (lanceur.cooldownsPosesCeTour ??= new Set()).add(cle);
      };
      if (sort.cooldown) {
        poser(`${sort.id}:${cibleTouchee.ref}`, sort.cooldown);
      }
      if (sort.cooldownTours) {
        poser(sort.id, sort.cooldownTours);
      }
    },
  };
}
function echecCritique(lancer) {
  let chance = sommeEffets(lancer.lanceur, `echecCritique`);
  if (chance > 0 && lancer.ctx.rng() < chance) {
    return (
      lancer.ctx.log(`${lancer.lanceur.nom} subit un échec critique : ${lancer.sort.nom} échoue !`),
      true
    );
  }
  return false;
}
const aUneCible = (lancer) => lancer.cible !== undefined;
const RESOLVEURS_SORTS = [
  {
    nom: `poseBombe`,
    declencheur: (sort) => !!sort.poseBombe,
    garde: aUneCible,
    resoudre: (lancer) => {
      let { ctx, poseCooldown } = lancer;
      let cible = lancer.cible;
      if (!poserBombe(cible, ctx)) {
        ctx.log(`La bombe glisse : ${cible.nom} est déjà chargé au maximum.`);
      }
      poseCooldown(cible);
    },
  },
  {
    nom: `posePiege`,
    declencheur: (sort) => !!sort.posePiege,
    garde: aUneCible,
    resoudre: (lancer) => {
      let { lanceur, sort, ctx, poseCooldown } = lancer;
      let cible = lancer.cible;
      let pieges = (lanceur.pieges ??= []);
      if (pieges.length >= 4) {
        pieges.shift();
      }
      pieges.push({
        sortId: sort.id,
        camp: cible.camp,
        avant: enLigneAvant(cible),
      });
      ctx.log(
        `${lanceur.nom} pose un piège sur la rangée ${enLigneAvant(cible) ? `avant` : `arrière`} de ${cible.nom}.`,
      );
      poseCooldown(cible);
    },
  },
  {
    nom: `kaboom`,
    declencheur: (sort) => !!sort.kaboom,
    resoudre: ({ lanceur, sort, cs, ctx }) => {
      declencherKaboom(lanceur, sort, cs, ctx);
    },
  },
  {
    nom: `boomerang`,
    declencheur: (sort) => !!sort.boomerang,
    garde: aUneCible,
    resoudre: (lancer) => {
      let { lanceur, sort, cs, ctx, poseCooldown } = lancer;
      let cible = lancer.cible;
      ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
      let mult = bonusPortails(lanceur, cs);
      lancerAttaque(
        lanceur,
        sort,
        cible,
        {
          useMax: false,
          mult: mult * bonusConjuration(lanceur, cible, cs),
          ctx,
        },
        sort.nom,
      );
      let derriere = allieDerriere(cible, cs);
      if (derriere && derriere.pvActuels > 0) {
        lancerAttaque(
          lanceur,
          sort,
          derriere,
          {
            useMax: false,
            mult: mult * bonusConjuration(lanceur, derriere, cs),
            ctx,
          },
          sort.nom,
        );
        if (cible.pvActuels > 0) {
          lancerAttaque(
            lanceur,
            sort,
            cible,
            {
              useMax: false,
              mult: mult * bonusConjuration(lanceur, cible, cs),
              ctx,
            },
            sort.nom,
          );
        }
      }
      poseCooldown(cible);
    },
  },
  {
    nom: `enflammee`,
    declencheur: (sort) => !!sort.enflammee,
    garde: aUneCible,
    resoudre: (lancer) => {
      let { lanceur, sort, cs, ctx, paAvant, poseCooldown } = lancer;
      let cible = lancer.cible;
      resoudreFlecheEnflammee(lanceur, sort, cible, cs, ctx, paAvant);
      poseCooldown(cible);
    },
  },
  {
    nom: `degatsPoussee`,
    declencheur: (sort) => !!sort.degatsPoussee,
    garde: aUneCible,
    resoudre: (lancer) => {
      let { lanceur, sort, cs, ctx, paAvant, poseCooldown } = lancer;
      let cible = lancer.cible;
      resoudreDegatsPoussee(lanceur, sort, cible, cs, ctx, paAvant);
      poseCooldown(cible);
    },
  },
  {
    nom: `mixteAllie`,
    declencheur: (sort) => sort.cible === `mixte` && !!sort.mixte,
    garde: (lancer) => lancer.cible !== undefined && lancer.cible.camp === lancer.lanceur.camp,
    repliSurDegats: true,
    resoudre: (lancer) => {
      let { lanceur, sort, ctx, poseCooldown } = lancer;
      let cible = lancer.cible;
      ctx.log(`${lanceur.nom} lance ${sort.nom} sur ${cible.nom}.`);
      let surAllie = sort.mixte.surAllie;
      if (surAllie.effet) {
        if (surAllie.nonCumulable) {
          cible.effets = cible.effets.filter((effet) => effet.stat !== surAllie.effet.stat);
        }
        appliquerEffet(cible, surAllie.effet);
      }
      if (surAllie.soin) {
        soigner(
          cible,
          Math.round(
            tirageEntier(surAllie.soin.min, surAllie.soin.max, ctx.rng) *
              multiplicateurSoinDe(lanceur),
          ),
          ctx,
        );
      }
      poseCooldown(cible);
    },
  },
  {
    nom: `invocation`,
    declencheur: (sort) => sort.type === `invocation`,
    resoudre: ({ lanceur, sort, cs, ctx, poseCooldown }) => {
      if (sort.invocation) {
        invoquerPoupee(lanceur, sort.invocation, cs, ctx);
      }
      if (sort.invoqueMonstre) {
        invoquerMonstre(lanceur, sort.invoqueMonstre, cs, ctx);
      }
      if (sort.ressuscite) {
        ressusciterAllie(lanceur, sort.ressuscite, cs, ctx);
      }
      if (sort.invoqueCreature) {
        invoquerCreature(lanceur, sort.invoqueCreature, cs, ctx);
      }
      poseCooldown(lanceur);
    },
  },
  {
    nom: `consommeRage`,
    declencheur: (sort) => !!sort.consommeRage,
    resoudre: ({ lanceur, sort, ctx, poseCooldown }) => {
      let rage = lanceur.rage ?? 0;
      if (rage <= 0) {
        return;
      }
      lanceur.rage = 0;
      let soin = Math.round(
        tirageEntier(sort.baseMin, sort.baseMax, ctx.rng) * rage * multiplicateurSoinDe(lanceur),
      );
      ctx.log(`${lanceur.nom} lance ${sort.nom} : ${rage} Rage consommée${rage > 1 ? `s` : ``}.`);
      soigner(lanceur, soin, ctx);
      poseCooldown(lanceur);
    },
  },
  {
    nom: `changeLigne`,
    declencheur: (sort) => !!sort.changeLigne,
    resoudre: ({ lanceur, cs, ctx, poseCooldown }) => {
      let positionLibre = caseOpposeeLibre(lanceur, cs);
      if (positionLibre !== null) {
        lanceur.position = positionLibre;
        ctx.log(
          `${lanceur.nom} se glisse en ligne ${positionLibre < 4 ? `AVANT` : `ARRIÈRE`} (Dagues Eurfolles).`,
        );
        poseCooldown(lanceur);
      }
    },
  },
  {
    nom: `invoqueLance`,
    declencheur: (sort) => !!sort.invoqueLance,
    resoudre: ({ lanceur, cible, cs, ctx, poseCooldown }) => {
      if (cible) {
        planterLance(lanceur, cible, cs, ctx);
        poseCooldown(lanceur);
      }
    },
  },
  {
    nom: `invoqueEgide`,
    declencheur: (sort) => !!sort.invoqueEgide,
    resoudre: ({ lanceur, sort, cible, cs, ctx, poseCooldown }) => {
      if (cible) {
        invoquerEgide(lanceur, cible, sort.invoqueEgide.tours, cs, ctx);
        poseCooldown(lanceur);
      }
    },
  },
  {
    nom: `rappelleLance`,
    declencheur: (sort) => !!sort.rappelleLance,
    resoudre: ({ lanceur, sort, cs, ctx, poseCooldown }) => {
      let lance = cs.find(
        (combattant) => combattant.ref === `lance_${lanceur.ref}` && combattant.pvActuels > 0,
      );
      if (!lance) {
        return;
      }
      let pvLance = lance.pvActuels;
      for (ctx.log(`${lanceur.nom} rappelle sa lance (Vajra).`); lance.pvActuels > 0;) {
        infligerDegats(lance, 1, undefined, ctx);
      }
      soigner(
        lanceur,
        Math.round(sort.rappelleLance.soinParDurabilite * pvLance * multiplicateurSoinDe(lanceur)),
        ctx,
      );
      poseCooldown(lanceur);
    },
  },
  {
    nom: `redirigeArriere`,
    declencheur: (sort) => !!sort.redirigeArriere,
    resoudre: ({ lanceur, sort, ctx, poseCooldown }) => {
      lanceur.redirection = {
        ratio: sort.redirigeArriere.ratio,
        tours: sort.redirigeArriere.duree,
      };
      lanceur.redirectionPoseCeTour = true;
      ctx.log(`${lanceur.nom} lance ${sort.nom} : protège sa rangée arrière.`);
      poseCooldown(lanceur);
    },
  },
  {
    nom: `soin`,
    declencheur: (sort) => sort.type === `soin`,
    resoudre: ({ lanceur, sort, cible, cs, ctx, poseCooldown }) => {
      ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
      for (let soutenu of ciblesSoutien(sort, lanceur, cible, cs)) {
        soigner(
          soutenu,
          sort.soinComplet
            ? soutenu.pvMax - soutenu.pvActuels
            : Math.round(
                tirageEntier(sort.baseMin, sort.baseMax, ctx.rng) *
                  multiplicateurSoinDe(lanceur) *
                  multiplicateurSoinCreature(lanceur),
              ),
          ctx,
        );
        poseCooldown(soutenu);
      }
      effetsClasseApresSoin(lanceur, sort, cs, ctx);
    },
  },
  {
    nom: `marqueProie`,
    declencheur: (sort) => !!sort.marqueProie,
    garde: aUneCible,
    resoudre: (lancer) => {
      let { lanceur, sort, cs, ctx, poseCooldown } = lancer;
      let cible = lancer.cible;
      for (let combattant of cs) {
        combattant.effets = combattant.effets.filter((effet) => effet.stat !== `proie`);
      }
      cible.effets.push({
        stat: `proie`,
        valeur: sort.marqueProie,
        toursRestants: 99,
      });
      ctx.log(
        `🎯 ${lanceur.nom} désigne ${cible.nom} comme Proie : l'équipe vole ${Math.round(sort.marqueProie * 100)} % des dégâts qu'elle lui inflige.`,
      );
      poseCooldown(cible);
    },
  },
  {
    nom: `paParTourLigne`,
    declencheur: (sort) => !!sort.paParTourLigne,
    garde: aUneCible,
    resoudre: (lancer) => {
      let { lanceur, sort, cs, ctx, poseCooldown } = lancer;
      let paParTour = sort.paParTourLigne;
      let cible = lancer.cible;
      let ligne = alliesVivants(lanceur, cs).filter(
        (allie) => enLigneAvant(allie) === enLigneAvant(cible),
      );
      for (let allie of ligne) {
        appliquerEffet(allie, {
          stat: `paParTour`,
          valeur: paParTour.valeur,
          duree: paParTour.duree,
        });
      }
      ctx.log(
        `${lanceur.nom} lance ${sort.nom} : la ligne de ${cible.nom} gagne +${paParTour.valeur} PA/tour.`,
      );
      poseCooldown(cible);
    },
  },
  {
    nom: `posePortail`,
    declencheur: (sort) => !!sort.posePortail,
    resoudre: ({ lanceur, ctx, poseCooldown }) => {
      ouvrirPortail(lanceur, ctx);
      poseCooldown(lanceur);
    },
  },
  {
    nom: `paProchainTourLigne`,
    declencheur: (sort) => !!sort.paProchainTourLigne,
    resoudre: ({ lanceur, sort, cs, ctx, poseCooldown }) => {
      let paProchainTour = sort.paProchainTourLigne;
      let pa =
        (lanceur.portails ?? 0) >= paProchainTour.seuil
          ? paProchainTour.valeurSeuil
          : paProchainTour.valeur;
      let ligne = alliesVivants(lanceur, cs).filter(
        (allie) => enLigneAvant(allie) === enLigneAvant(lanceur),
      );
      for (let allie of ligne) {
        allie.paBonusNextTurn += pa;
      }
      ctx.log(`${lanceur.nom} lance ${sort.nom} : sa rangée gagne +${pa} PA au prochain tour.`);
      poseCooldown(lanceur);
    },
  },
  {
    nom: `facesAleatoires`,
    declencheur: (sort) => !!sort.facesAleatoires,
    resoudre: ({ lanceur, sort, cs, ctx, poseCooldown }) => {
      let faces = sort.facesAleatoires;
      ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
      let nbTirages =
        aBonusSiCrit(sort) &&
        ctx.rng() < chanceCritique(statsEffectives(lanceur)) &&
        sort.tiragesSiCrit
          ? sort.tiragesSiCrit
          : 1;
      for (let tirage = 0; tirage < nbTirages; tirage++) {
        let face = faces[Math.floor(ctx.rng() * faces.length)];
        ctx.log(`${lanceur.nom} tire : ${descriptionBuff(face)}.`);
        for (let cibleGroupe of ciblesBouclierGroupe(lanceur, cs, face.portee)) {
          if (face.effet) {
            appliquerEffet(cibleGroupe, face.effet);
          }
        }
        if (face.bouclierPct) {
          bouclierGroupe(lanceur, cs, face.portee, face.bouclierPct, face.duree, ctx);
        }
      }
      poseCooldown(lanceur);
    },
  },
  {
    nom: `soutien`,
    declencheur: (sort) => sort.type === `buff` || sort.type === `debuff`,
    resoudre: ({ lanceur, sort, cible, cs, ctx, poseCooldown }) => {
      ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
      let critique = aBonusSiCrit(sort) && ctx.rng() < chanceCritique(statsEffectives(lanceur));
      for (let soutenu of ciblesSoutien(sort, lanceur, cible, cs)) {
        appliquerSoutien(sort, soutenu, lanceur, ctx, critique);
        effetsClasseSoutien(sort, soutenu, lanceur, cs, ctx);
        poseCooldown(soutenu);
      }
      if (sort.effetRangeeAlliee) {
        buffRangee(lanceur, sort.effetRangeeAlliee, cs, ctx);
      }
      if (sort.bouclierPortee) {
        let { portee, pct, tours } = sort.bouclierPortee;
        bouclierGroupe(lanceur, cs, portee, pct, tours, ctx);
      }
      if (sort.esquivePartageeRangee) {
        brumeRangee(lanceur, cible ?? lanceur, sort.esquivePartageeRangee.duree, cs, ctx);
      }
    },
  },
];
function trouverResolveur(lancer) {
  return RESOLVEURS_SORTS.find(
    (resolveur) => resolveur.declencheur(lancer.sort) && (resolveur.garde?.(lancer) ?? true),
  );
}
function resoudreDegats(lancer) {
  let { cible } = lancer;
  if (!cible) {
    return;
  }
  let lancerCible = {
    ...lancer,
    cible,
  };
  let mults = multiplicateursLancer(lancerCible);
  if (lancerCible.sort.soinLigneAvantRatio) {
    resoudreSoinLigneAvant(lancerCible, mults);
    return;
  }
  let resultat = appliquerDegatsSort(lancerCible, mults);
  propagerInfection(lancerCible.lanceur, lancerCible.sort, cible, lancerCible.cs, lancerCible.ctx);
  effetsApresDegats(lancerCible, resultat);
  soinsApresDegats(
    lancerCible,
    resultat,
    resultat.totalDmg + degatsToucheDerriere(lancerCible, mults),
  );
  effetsFinLancer(lancerCible, resultat);
  lancerCible.poseCooldown(cible);
}
function multiplicateursLancer({ lanceur, sort, cible, cs }) {
  let useMax = consommerMaxRoll(lanceur);
  let lanceur_bonusOffensifProchain = lanceur.bonusOffensifProchain;
  lanceur.bonusOffensifProchain = 0;
  let multLigne =
    1 +
    (lanceur.bonusParAllieLigne ?? 0) *
      alliesVivants(lanceur, cs).filter(
        (allie) => allie.ref !== lanceur.ref && enLigneAvant(allie) === enLigneAvant(lanceur),
      ).length;
  multLigne *= bonusPortails(lanceur, cs);
  multLigne *= bonusConjuration(lanceur, cible, cs);
  if (sort.bonusParEnnemiLigneCible) {
    multLigne *=
      1 +
      sort.bonusParEnnemiLigneCible *
        ennemisVivants(lanceur, cs).filter(
          (ennemi) =>
            ennemi.ref !== cible.ref &&
            !ennemi.estLance &&
            enLigneAvant(ennemi) === enLigneAvant(cible),
        ).length;
  }
  let multChausse = sort.bonusParChausseTrappe
    ? 1 + sort.bonusParChausseTrappe * Math.min(lanceur.chausseTrappe ?? 0, 5)
    : 1;
  if (sort.bonusParEnnemiToucheZone) {
    let nbTouches = ciblesTouchees(lanceur, sort, cible, cs).filter(
      (touche) => !touche.estLance,
    ).length;
    multLigne *= 1 + sort.bonusParEnnemiToucheZone * nbTouches;
  }
  return {
    useMax,
    bonusVigueur: lanceur_bonusOffensifProchain,
    multLigne,
    multChausse,
  };
}
function resoudreSoinLigneAvant(
  { lanceur, sort, cible, cs, ctx, paAvant, poseCooldown },
  { useMax, bonusVigueur, multLigne },
) {
  ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
  let totalDegats = 0;
  for (let touche of ciblesTouchees(lanceur, sort, cible, cs)) {
    let degats = lancerAttaque(
      lanceur,
      sort,
      touche,
      {
        useMax,
        mult: (1 + bonusVigueur) * multLigne,
        ctx,
        paAvant,
      },
      sort.nom,
    );
    if (!touche.estLance) {
      totalDegats += degats;
    }
  }
  let alliesAvant = alliesVivants(lanceur, cs).filter(enLigneAvant);
  if (totalDegats > 0 && alliesAvant.length) {
    let soin = Math.round(
      ((totalDegats * sort.soinLigneAvantRatio) / alliesAvant.length) *
        multiplicateurSoinDe(lanceur),
    );
    for (let allie of alliesAvant) {
      soigner(allie, soin, ctx);
    }
  }
  poseCooldown(cible);
}
function multiplicateurCible(sort, ref, touche, rangSaut) {
  return (
    (sort.rebond ? 1 + sort.rebond.bonusParSaut * rangSaut : 1) *
    (sort.ratioLigne && touche.ref !== ref ? sort.ratioLigne : 1)
  );
}
function appliquerDegatsSort(lancer, mults) {
  let { lanceur, sort, cible, cs, ctx, paAvant, multEscalade } = lancer;
  let { useMax, bonusVigueur, multLigne, multChausse } = mults;
  let totalDmg = 0;
  let touchees = ciblesTouchees(lanceur, sort, cible, cs);
  let sansDegats = sort.baseMax === 0 && (!!sort.deplaceCible || !!sort.conjuration);
  let nonEsquivees = new Set();
  let unCritique = false;
  touchees.forEach((touche, indice) => {
    if (sansDegats) {
      return;
    }
    let libelle =
      sort.ratioLigne && touche.ref !== cible?.ref ? `${sort.nom} (éclaboussure)` : sort.nom;
    let mult =
      multiplicateurCible(sort, cible.ref, touche, indice) *
      (1 + bonusVigueur) *
      multLigne *
      multEscalade *
      multChausse;
    let detail = calculerDegats(lanceur, sort, touche, {
      useMax,
      mult,
      ctx,
      paAvant,
    });
    if (detail.esquive) {
      ctx.log(`${touche.nom} esquive ${libelle} !`);
      ctx.fx?.({
        type: `esquive`,
        ref: touche.ref,
      });
    } else {
      if (detail.crit) {
        ctx.fx?.({
          type: `crit`,
          ref: touche.ref,
        });
        unCritique = true;
      }
      infligerDegats(
        touche,
        detail.dmg,
        lanceur,
        ctx,
        sort.ignoreBouclier,
        undefined,
        detail.element,
      );
      nonEsquivees.add(touche.ref);
      if (!touche.estLance) {
        totalDmg += detail.dmg;
      }
      if (!touche.estLance) {
        logDegats(
          ctx,
          `${lanceur.nom} → ${libelle} sur ${touche.nom} : `,
          detail.dmg,
          detail.element,
          `${detail.crit ? ` (CRIT)` : ``}.${touche.pvActuels <= 0 ? ` ${touche.nom} est K.O. !` : ``}`,
        );
      }
      if (touche.pvActuels > 0) {
        totalDmg += effetsSurCibleTouchee(lancer, touche, detail, mult, mults);
      }
    }
  });
  return {
    touchees,
    nonEsquivees,
    totalDmg,
    unCritique,
  };
}
function effetsSurCibleTouchee({ lanceur, sort, ctx, paAvant }, cible, detail, mult, { useMax }) {
  let total = 0;
  effetsClasseSurCible(lanceur, sort, cible, detail, ctx);
  if (detail.crit && detail.dmg > 0 && reliquesActivesDe(lanceur, ctx).has(`dofus_forgelave`)) {
    appliquerPoison(cible, { degats: Math.max(1, Math.round(detail.dmg * 0.15)), duree: 2 });
    ctx.log(`🔥 Le Dofus Forgelave embrase ${cible.nom}.`);
  }
  if (sort.poison) {
    appliquerPoison(cible, sort.poison);
  }
  if (sort.poisonSiPortails && (lanceur.portails ?? 0) >= sort.poisonSiPortails.seuil) {
    appliquerPoison(cible, {
      degats: Math.round(detail.dmg * sort.poisonSiPortails.ratio),
      duree: sort.poisonSiPortails.duree,
    });
  }
  if (sort.effet) {
    appliquerEffet(
      cible,
      sort.effetSiPortails && (lanceur.portails ?? 0) >= sort.effetSiPortails.seuil
        ? {
            ...sort.effet,
            valeur: sort.effetSiPortails.valeur,
          }
        : sort.effet,
    );
  }
  if (sort.retraitPAProchainTour) {
    cible.paBonusNextTurn -= sort.retraitPAProchainTour;
    ctx.log(
      `${cible.nom} commencera son prochain tour amputé de ${sort.retraitPAProchainTour} PA (Tétanie).`,
    );
  }
  if (sort.assome && !cible.estLance && ctx.rng() < sort.assome) {
    appliquerEffet(cible, {
      stat: `assome`,
      valeur: 1,
      duree: 1,
    });
    ctx.log(`💫 ${cible.nom} est assommé : il passera son prochain tour !`);
  }
  if (sort.procAleatoire && sort.procAleatoire.length) {
    let proc = sort.procAleatoire[Math.floor(ctx.rng() * sort.procAleatoire.length)];
    if (proc.dissipePositifs) {
      desenvouter(cible, ctx);
    }
    if (proc.effet) {
      appliquerEffet(cible, proc.effet);
    }
  }
  if (sort.secondCoupSiCrit && detail.crit) {
    let secondCoup = lancerAttaque(
      lanceur,
      {
        ...sort,
        elementPire: false,
        sansEsquiveNiCrit: true,
      },
      cible,
      {
        useMax,
        mult,
        ctx,
        paAvant,
      },
      `${sort.nom} (retour)`,
    );
    if (!cible.estLance) {
      total += secondCoup;
    }
  }
  return total;
}
function effetsApresDegats({ lanceur, sort, cible, cs, ctx }, { nonEsquivees, totalDmg }) {
  if (totalDmg > 0) {
    appliquerDofusTachete(lanceur, cs, reliquesActivesDe(lanceur, ctx));
  }
  if (sort.consommeChausseTrappe) {
    lanceur.chausseTrappe = 0;
  }
  if (sort.effetLigneCible && nonEsquivees.has(cible.ref)) {
    let ligne = vivants(cs).filter(
      (combattant) =>
        combattant.camp === cible.camp && enLigneAvant(combattant) === enLigneAvant(cible),
    );
    for (let membre of ligne) {
      let existant = membre.effets.find((effet) => effet.stat === sort.effetLigneCible.stat);
      if (existant) {
        existant.toursRestants = sort.effetLigneCible.duree;
      } else {
        appliquerEffet(membre, sort.effetLigneCible);
      }
    }
    ctx.log(
      `${lanceur.nom} marque la rangée de ${cible.nom} : ${sort.effetLigneCible.stat} ${sort.effetLigneCible.valeur >= 0 ? `+` : ``}${sort.effetLigneCible.valeur} (${sort.effetLigneCible.duree}t).`,
    );
  }
  if (sort.effetRangeeAlliee) {
    buffRangee(lanceur, sort.effetRangeeAlliee, cs, ctx);
  }
  if (sort.bouclierPortee) {
    let { portee, pct, tours } = sort.bouclierPortee;
    bouclierGroupe(lanceur, cs, portee, pct, tours, ctx);
  }
  if (sort.conjuration && !cible.estLance) {
    let pct =
      (lanceur.portails ?? 0) >= sort.conjuration.seuil
        ? sort.conjuration.pctSeuil
        : sort.conjuration.pct;
    cible.conjuration = {
      pct,
      lanceurRef: lanceur.ref,
      tours: sort.conjuration.duree,
    };
    ctx.log(
      `${lanceur.nom} lance ${sort.nom} : ${cible.nom} est marqué (+${Math.round(pct * 100)} %, ${sort.conjuration.duree}t).`,
    );
  }
}
function degatsToucheDerriere({ lanceur, sort, cible, cs, ctx }, mults) {
  if (!sort.toucheDerriere) {
    return 0;
  }
  let derriere = allieDerriere(cible, cs);
  if (!derriere || derriere.pvActuels <= 0) {
    return 0;
  }
  let degats = lancerAttaque(
    lanceur,
    sort,
    derriere,
    {
      useMax: mults.useMax,
      mult: (1 + mults.bonusVigueur) * mults.multLigne,
      ctx,
    },
    sort.nom,
  );
  if (derriere.estLance) {
    return 0;
  }
  return degats;
}
function soinsApresDegats({ lanceur, sort, cs, ctx }, { touchees, nonEsquivees }, degatsTotal) {
  if (sort.soinAllieBlesseRatio && degatsTotal > 0) {
    soignerPlusBlesse(
      alliesVivants(lanceur, cs),
      sort.soinAllieBlesseRatio,
      degatsTotal,
      lanceur,
      ctx,
    );
  }
  if (sort.soinAvantBlesseRatio && degatsTotal > 0) {
    soignerPlusBlesse(
      alliesVivants(lanceur, cs).filter(enLigneAvant),
      sort.soinAvantBlesseRatio,
      degatsTotal,
      lanceur,
      ctx,
    );
  }
  if (sort.soinEquipeRatio && degatsTotal > 0) {
    let soin = Math.round(degatsTotal * sort.soinEquipeRatio * multiplicateurSoinDe(lanceur));
    for (let allie of alliesVivants(lanceur, cs)) {
      soigner(allie, soin, ctx);
    }
    ctx.log(`${lanceur.nom} draine ${soin} PV pour l'équipe.`);
  }
  if (sort.bouclierRatioDegats && degatsTotal > 0) {
    let bouclier = Math.round(degatsTotal * sort.bouclierRatioDegats);
    lanceur.bouclier += bouclier;
    ctx.log(`${lanceur.nom} gagne un bouclier de ${bouclier}.`);
  }
  if (sort.bouclierParEnnemiTouche) {
    let nb = touchees.filter((touche) => !touche.estLance && nonEsquivees.has(touche.ref)).length;
    if (nb > 0) {
      let bouclier = sort.bouclierParEnnemiTouche * nb;
      lanceur.bouclier += bouclier;
      ctx.log(`${lanceur.nom} gagne un bouclier de ${bouclier} (Hydra).`);
    }
  }
  if (sort.vampirismeRatio && degatsTotal > 0) {
    soigner(
      lanceur,
      Math.round(degatsTotal * sort.vampirismeRatio * multiplicateurSoinDe(lanceur)),
      ctx,
    );
  }
}
function effetsFinLancer(
  { lanceur, sort, cible, cs, ctx },
  { touchees, nonEsquivees, unCritique },
) {
  if (sort.retraitPA) {
    for (let touche of touchees) {
      touche.pvActuels <= 0 ||
        touche.estLance ||
        !nonEsquivees.has(touche.ref) ||
        (ctx.rng() < (sort.retraitPAChance ?? 0.3) && retirerPA(touche, sort.retraitPA, ctx));
    }
  }
  if (sort.deplaceCible && cible.pvActuels > 0) {
    let doitTelefrag = sort.telefragSiOccupee
      ? vivants(cs).some(
          (combattant) =>
            combattant.camp === cible.camp && enLigneAvant(combattant) !== enLigneAvant(cible),
        )
      : false;
    let positionAvant = cible.position;
    repousser(cible, sort.deplaceCible, cs, ctx);
    if (
      sort.telefragSiOccupee &&
      doitTelefrag &&
      cible.position !== positionAvant &&
      cible.pvActuels > 0
    ) {
      poserTelefrag(cible, cs, ctx, lanceur);
      let voisin = vivants(cs)
        .filter(
          (combattant) =>
            combattant.camp === cible.camp &&
            combattant.ref !== cible.ref &&
            enLigneAvant(combattant) === enLigneAvant(cible),
        )
        .sort(
          (premier, second) =>
            Math.abs(premier.position - cible.position) -
            Math.abs(second.position - cible.position),
        )[0];
      if (voisin) {
        poserTelefrag(voisin, cs, ctx, lanceur);
      }
    }
  }
  if (sort.effetLanceur) {
    appliquerEffet(lanceur, sort.effetLanceur);
  }
  if (sort.reduitCoutSiCrit && unCritique) {
    lanceur.remisesCout ??= {};
    let coutAvant = coutPA(sort, lanceur);
    lanceur.remisesCout[sort.id] = (lanceur.remisesCout[sort.id] ?? 0) + sort.reduitCoutSiCrit;
    let coutApres = coutPA(sort, lanceur);
    if (coutApres < coutAvant) {
      ctx.log(
        `${lanceur.nom} réduit le coût de son prochain ${sort.nom} de ${coutAvant - coutApres} PA.`,
      );
    }
  }
  if (sort.rage) {
    gagnerRage(lanceur, ctx);
  }
  effetsClasseFinLancer(lanceur, sort, cs, ctx);
}
export function lancerSort(lanceur, sort, cibleRef, combattants, contexte) {
  sort = sortSelonEtat(lanceur, sort);
  let lancer = preparerLancer(lanceur, sort, cibleRef, combattants, contexte);
  if (echecCritique(lancer)) {
    return;
  }
  let resolveur = trouverResolveur(lancer);
  if (resolveur) {
    resolveur.resoudre(lancer);
  } else {
    resoudreDegats(lancer);
  }
}
