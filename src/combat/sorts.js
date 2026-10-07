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
export function lancerAttaque(e, t, n, r, i) {
  let a = calculerDegatsDetail(e, t, n, r);
  if (a.esquive) {
    return (
      r.ctx.log(`${n.nom} esquive ${i} !`),
      r.ctx.fx?.({
        type: `esquive`,
        ref: n.ref,
      }),
      0
    );
  }
  return (
    a.crit &&
      r.ctx.fx?.({
        type: `crit`,
        ref: n.ref,
      }),
    infligerDegats(n, a.dmg, e, r.ctx, undefined, undefined, a.element),
    n.estLance ||
      logDegats(
        r.ctx,
        `${e.nom} → ${i} sur ${n.nom} : `,
        a.dmg,
        a.element,
        `${a.crit ? ` (CRIT)` : ``}.${n.pvActuels <= 0 ? ` ${n.nom} est K.O. !` : ``}`,
      ),
    a.dmg
  );
}
export function declencherPiege(e, t, n) {
  let r = null;
  for (let poseur_1 of t) {
    if (!poseur_1.pieges?.length) {
      continue;
    }
    let index_1 = poseur_1.pieges.findIndex(
      (t) => t.camp === e.camp && t.avant === enLigneAvant(e),
    );
    if (index_1 >= 0) {
      r = {
        poseur: poseur_1,
        index: index_1,
      };
      break;
    }
  }
  if (!r) {
    return;
  }
  let { poseur, index } = r;
  let o = SORTS[poseur.pieges[index].sortId];
  if (!o) {
    return;
  }
  poseur.pieges.splice(index, 1);
  n.log(`💥 Le piège de ${poseur.nom} se déclenche sur ${e.nom} !`);
  let s =
    bonusPortails(poseur, t) *
    bonusConjuration(poseur, e, t) *
    (1 + sommeEffets(poseur, `bonusPieges`));
  if (o.bonusParEnnemiLigneCible) {
    s *=
      1 +
      o.bonusParEnnemiLigneCible *
        ennemisVivants(poseur, t).filter(
          (t) => t.ref !== e.ref && !t.estLance && enLigneAvant(t) === enLigneAvant(e),
        ).length;
  }
  let c = ciblesTouchees(poseur, o, e, t);
  for (let t of c) {
    let r = !!o.ratioLigne && t.ref !== e.ref;
    let a = r ? o.ratioLigne : 1;
    let c = r ? `${o.nom} (piège, éclaboussure)` : `${o.nom} (piège)`;
    lancerAttaque(
      poseur,
      o,
      t,
      {
        useMax: false,
        mult: s * a,
        ctx: n,
      },
      c,
    );
  }
  poseur.chausseTrappe = Math.min(5, (poseur.chausseTrappe ?? 0) + 1);
}
function declencherKaboom(lanceur, sort, n, ctx) {
  let i = new Set();
  let a = bonusPortails(lanceur, n);
  for (let o of ennemisVivants(lanceur, n).filter((e) => (e.bombes ?? 0) > 0)) {
    let s = o.bombes ?? 0;
    let c = ennemisVivants(lanceur, n).filter(
      (e) => e.ref !== o.ref && enLigneAvant(e) === enLigneAvant(o),
    );
    for (let l = 0; l < s && o.pvActuels > 0; l++) {
      if (
        lancerAttaque(
          lanceur,
          sort,
          o,
          {
            useMax: false,
            mult: a * bonusConjuration(lanceur, o, n),
            ctx,
          },
          sort.nom,
        ) > 0 &&
        !o.estLance
      ) {
        i.add(o.ref);
      }
      for (let o of c) {
        o.pvActuels <= 0 ||
          (lancerAttaque(
            lanceur,
            sort,
            o,
            {
              useMax: false,
              mult: 0.5 * a * bonusConjuration(lanceur, o, n),
              ctx,
            },
            sort.nom,
          ) > 0 &&
            !o.estLance &&
            i.add(o.ref));
      }
    }
  }
  if (lanceur.resquilleActive) {
    for (let t of i) {
      let i = trouverParRef(n, t);
      if (i && i.pvActuels > 0) {
        retirerPA(i, lanceur.resquilleActive, ctx);
      }
    }
  }
  lanceur.resquilleActive = undefined;
  for (let e of n) {
    e.bombes = 0;
  }
}
function resoudreFlecheEnflammee(lanceur, sort, n, r, ctx, paAvant) {
  ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
  let o = {
    baseMin: sort.baseMin,
    baseMax: sort.baseMax,
  };
  let s = bonusPortails(lanceur, r);
  let c = {
    useMax: false,
    mult: s * bonusConjuration(lanceur, n, r),
    ctx,
    paAvant,
  };
  lancerAttaque(lanceur, o, n, c, sort.nom);
  if (enLigneAvant(n)) {
    let i = ennemisVivants(lanceur, r).filter((e) => !enLigneAvant(e));
    for (let a of plusProches(n, i, 2)) {
      lancerAttaque(
        lanceur,
        o,
        a,
        {
          ...c,
          mult: 0.5 * s * bonusConjuration(lanceur, a, r),
        },
        `${sort.nom} (éclaboussure)`,
      );
    }
  } else {
    let i = ennemisVivants(lanceur, r).filter((e) => e.ref !== n.ref && !enLigneAvant(e));
    for (let a of plusProches(n, i, 2)) {
      lancerAttaque(
        lanceur,
        o,
        a,
        {
          ...c,
          mult: s * bonusConjuration(lanceur, a, r),
        },
        `${sort.nom} (éclaboussure)`,
      );
    }
  }
}
function resoudreDegatsPoussee(lanceur, sort, n, r, ctx, paAvant) {
  ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
  let o = {
    baseMin: sort.baseMin,
    baseMax: sort.baseMax,
    ignoreResistances: true,
  };
  let s = bonusPortails(lanceur, r);
  let c = (t) => ({
    useMax: false,
    mult: s * bonusConjuration(lanceur, t, r),
    ctx,
    paAvant,
  });
  let l = vivants(r).filter(
    (e) => e.camp === n.camp && e.ref !== n.ref && enLigneAvant(e) === enLigneAvant(n),
  );
  if (l.length > 0) {
    let r = plusProches(n, l, 1)[0];
    lancerAttaque(lanceur, o, n, c(n), `${sort.nom} (bousculade)`);
    lancerAttaque(lanceur, o, r, c(r), `${sort.nom} (bousculade)`);
    return;
  }
  let u = vivants(r).filter((e) => e.camp === n.camp && e.ref !== n.ref && !enLigneAvant(e));
  let n_position = n.position;
  repousser(n, `arriere`, r, ctx);
  if (n.position === n_position || n.pvActuels <= 0) {
    return;
  }
  let f = plusProches(n, u, 1)[0];
  if (f) {
    lancerAttaque(lanceur, o, n, c(n), `${sort.nom} (bousculade)`);
    lancerAttaque(lanceur, o, f, c(f), `${sort.nom} (bousculade)`);
  }
}
function preparerLancer(lanceur, sort, cibleRef, cs, i) {
  i.combatants = cs;
  let paAvant = lanceur.paActuels + coutPA(sort, lanceur);
  let cible = trouverParRef(cs, cibleRef);
  let multEscalade = multiplicateurRelance(sort, lanceur);
  if (sort.maxParTour || sort.maxParCibleParTour || sort.bonusParRelanceCeTour) {
    let r = (lanceur.lancersCeTour ??= {});
    r[sort.id] = (r[sort.id] ?? 0) + 1;
    if (cibleRef) {
      r[`${sort.id}:${cibleRef}`] = (r[`${sort.id}:${cibleRef}`] ?? 0) + 1;
    }
  }
  if (sort.bonusParLancerCombat) {
    let n = (lanceur.lancersCombat ??= {});
    n[sort.id] = (n[sort.id] ?? 0) + 1;
  }
  return {
    lanceur,
    sort,
    cibleRef,
    cible,
    cs,
    ctx: i,
    paAvant,
    multEscalade,
    poseCooldown: (n) => {
      let r = (t, n) => {
        lanceur.cooldowns[t] = n;
        (lanceur.cooldownsPosesCeTour ??= new Set()).add(t);
      };
      if (sort.cooldown) {
        r(`${sort.id}:${n.ref}`, sort.cooldown);
      }
      if (sort.cooldownTours) {
        r(sort.id, sort.cooldownTours);
      }
    },
  };
}
function echecCritique(e) {
  let t = sommeEffets(e.lanceur, `echecCritique`);
  if (t > 0 && e.ctx.rng() < t) {
    return (e.ctx.log(`${e.lanceur.nom} subit un échec critique : ${e.sort.nom} échoue !`), true);
  }
  return false;
}
const aUneCible = (e) => e.cible !== undefined;
const RESOLVEURS_SORTS = [
  {
    nom: `poseBombe`,
    declencheur: (e) => !!e.poseBombe,
    garde: aUneCible,
    resoudre: (e) => {
      let { ctx, poseCooldown } = e;
      let e_cible = e.cible;
      if (!poserBombe(e_cible, ctx)) {
        ctx.log(`La bombe glisse : ${e_cible.nom} est déjà chargé au maximum.`);
      }
      poseCooldown(e_cible);
    },
  },
  {
    nom: `posePiege`,
    declencheur: (e) => !!e.posePiege,
    garde: aUneCible,
    resoudre: (e) => {
      let { lanceur, sort, ctx, poseCooldown } = e;
      let e_cible = e.cible;
      let o = (lanceur.pieges ??= []);
      if (o.length >= 4) {
        o.shift();
      }
      o.push({
        sortId: sort.id,
        camp: e_cible.camp,
        avant: enLigneAvant(e_cible),
      });
      ctx.log(
        `${lanceur.nom} pose un piège sur la rangée ${enLigneAvant(e_cible) ? `avant` : `arrière`} de ${e_cible.nom}.`,
      );
      poseCooldown(e_cible);
    },
  },
  {
    nom: `kaboom`,
    declencheur: (e) => !!e.kaboom,
    resoudre: ({ lanceur, sort, cs, ctx }) => {
      declencherKaboom(lanceur, sort, cs, ctx);
    },
  },
  {
    nom: `boomerang`,
    declencheur: (e) => !!e.boomerang,
    garde: aUneCible,
    resoudre: (e) => {
      let { lanceur, sort, cs, ctx, poseCooldown } = e;
      let e_cible = e.cible;
      ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
      let s = bonusPortails(lanceur, cs);
      lancerAttaque(
        lanceur,
        sort,
        e_cible,
        {
          useMax: false,
          mult: s * bonusConjuration(lanceur, e_cible, cs),
          ctx,
        },
        sort.nom,
      );
      let c = allieDerriere(e_cible, cs);
      if (c && c.pvActuels > 0) {
        lancerAttaque(
          lanceur,
          sort,
          c,
          {
            useMax: false,
            mult: s * bonusConjuration(lanceur, c, cs),
            ctx,
          },
          sort.nom,
        );
        if (e_cible.pvActuels > 0) {
          lancerAttaque(
            lanceur,
            sort,
            e_cible,
            {
              useMax: false,
              mult: s * bonusConjuration(lanceur, e_cible, cs),
              ctx,
            },
            sort.nom,
          );
        }
      }
      poseCooldown(e_cible);
    },
  },
  {
    nom: `enflammee`,
    declencheur: (e) => !!e.enflammee,
    garde: aUneCible,
    resoudre: (e) => {
      let { lanceur, sort, cs, ctx, paAvant, poseCooldown } = e;
      let e_cible = e.cible;
      resoudreFlecheEnflammee(lanceur, sort, e_cible, cs, ctx, paAvant);
      poseCooldown(e_cible);
    },
  },
  {
    nom: `degatsPoussee`,
    declencheur: (e) => !!e.degatsPoussee,
    garde: aUneCible,
    resoudre: (e) => {
      let { lanceur, sort, cs, ctx, paAvant, poseCooldown } = e;
      let e_cible = e.cible;
      resoudreDegatsPoussee(lanceur, sort, e_cible, cs, ctx, paAvant);
      poseCooldown(e_cible);
    },
  },
  {
    nom: `mixteAllie`,
    declencheur: (e) => e.cible === `mixte` && !!e.mixte,
    garde: (e) => e.cible !== undefined && e.cible.camp === e.lanceur.camp,
    repliSurDegats: true,
    resoudre: (e) => {
      let { lanceur, sort, ctx, poseCooldown } = e;
      let e_cible = e.cible;
      ctx.log(`${lanceur.nom} lance ${sort.nom} sur ${e_cible.nom}.`);
      let surAllie = sort.mixte.surAllie;
      if (surAllie.effet) {
        if (surAllie.nonCumulable) {
          e_cible.effets = e_cible.effets.filter((e) => e.stat !== surAllie.effet.stat);
        }
        appliquerEffet(e_cible, surAllie.effet);
      }
      if (surAllie.soin) {
        soigner(
          e_cible,
          Math.round(
            tirageEntier(surAllie.soin.min, surAllie.soin.max, ctx.rng) *
              multiplicateurSoinDe(lanceur),
          ),
          ctx,
        );
      }
      poseCooldown(e_cible);
    },
  },
  {
    nom: `invocation`,
    declencheur: (e) => e.type === `invocation`,
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
    declencheur: (e) => !!e.consommeRage,
    resoudre: ({ lanceur, sort, ctx, poseCooldown }) => {
      let a = lanceur.rage ?? 0;
      if (a <= 0) {
        return;
      }
      lanceur.rage = 0;
      let o = Math.round(
        tirageEntier(sort.baseMin, sort.baseMax, ctx.rng) * a * multiplicateurSoinDe(lanceur),
      );
      ctx.log(`${lanceur.nom} lance ${sort.nom} : ${a} Rage consommée${a > 1 ? `s` : ``}.`);
      soigner(lanceur, o, ctx);
      poseCooldown(lanceur);
    },
  },
  {
    nom: `changeLigne`,
    declencheur: (e) => !!e.changeLigne,
    resoudre: ({ lanceur, cs, ctx, poseCooldown }) => {
      let a = caseOpposeeLibre(lanceur, cs);
      if (a !== null) {
        lanceur.position = a;
        ctx.log(
          `${lanceur.nom} se glisse en ligne ${a < 4 ? `AVANT` : `ARRIÈRE`} (Dagues Eurfolles).`,
        );
        poseCooldown(lanceur);
      }
    },
  },
  {
    nom: `invoqueLance`,
    declencheur: (e) => !!e.invoqueLance,
    resoudre: ({ lanceur, cible, cs, ctx, poseCooldown }) => {
      if (cible) {
        planterLance(lanceur, cible, cs, ctx);
        poseCooldown(lanceur);
      }
    },
  },
  {
    nom: `invoqueEgide`,
    declencheur: (e) => !!e.invoqueEgide,
    resoudre: ({ lanceur, sort, cible, cs, ctx, poseCooldown }) => {
      if (cible) {
        invoquerEgide(lanceur, cible, sort.invoqueEgide.tours, cs, ctx);
        poseCooldown(lanceur);
      }
    },
  },
  {
    nom: `rappelleLance`,
    declencheur: (e) => !!e.rappelleLance,
    resoudre: ({ lanceur, sort, cs, ctx, poseCooldown }) => {
      let o = cs.find((e) => e.ref === `lance_${lanceur.ref}` && e.pvActuels > 0);
      if (!o) {
        return;
      }
      let o_pvActuels = o.pvActuels;
      for (ctx.log(`${lanceur.nom} rappelle sa lance (Vajra).`); o.pvActuels > 0;) {
        infligerDegats(o, 1, undefined, ctx);
      }
      soigner(
        lanceur,
        Math.round(
          sort.rappelleLance.soinParDurabilite * o_pvActuels * multiplicateurSoinDe(lanceur),
        ),
        ctx,
      );
      poseCooldown(lanceur);
    },
  },
  {
    nom: `redirigeArriere`,
    declencheur: (e) => !!e.redirigeArriere,
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
    declencheur: (e) => e.type === `soin`,
    resoudre: ({ lanceur, sort, cible, cs, ctx, poseCooldown }) => {
      ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
      for (let e of ciblesSoutien(sort, lanceur, cible, cs)) {
        soigner(
          e,
          sort.soinComplet
            ? e.pvMax - e.pvActuels
            : Math.round(
                tirageEntier(sort.baseMin, sort.baseMax, ctx.rng) *
                  multiplicateurSoinDe(lanceur) *
                  multiplicateurSoinCreature(lanceur),
              ),
          ctx,
        );
        poseCooldown(e);
      }
      effetsClasseApresSoin(lanceur, sort, cs, ctx);
    },
  },
  {
    nom: `marqueProie`,
    declencheur: (e) => !!e.marqueProie,
    garde: aUneCible,
    resoudre: (e) => {
      let { lanceur, sort, cs, ctx, poseCooldown } = e;
      let e_cible = e.cible;
      for (let e of cs) {
        e.effets = e.effets.filter((e) => e.stat !== `proie`);
      }
      e_cible.effets.push({
        stat: `proie`,
        valeur: sort.marqueProie,
        toursRestants: 99,
      });
      ctx.log(
        `🎯 ${lanceur.nom} désigne ${e_cible.nom} comme Proie : l'équipe vole ${Math.round(sort.marqueProie * 100)} % des dégâts qu'elle lui inflige.`,
      );
      poseCooldown(e_cible);
    },
  },
  {
    nom: `paParTourLigne`,
    declencheur: (e) => !!e.paParTourLigne,
    garde: aUneCible,
    resoudre: (e) => {
      let { lanceur, sort, cs, ctx, poseCooldown } = e;
      let sort_paParTourLigne = sort.paParTourLigne;
      let e_cible = e.cible;
      let c = alliesVivants(lanceur, cs).filter((e) => enLigneAvant(e) === enLigneAvant(e_cible));
      for (let e of c) {
        appliquerEffet(e, {
          stat: `paParTour`,
          valeur: sort_paParTourLigne.valeur,
          duree: sort_paParTourLigne.duree,
        });
      }
      ctx.log(
        `${lanceur.nom} lance ${sort.nom} : la ligne de ${e_cible.nom} gagne +${sort_paParTourLigne.valeur} PA/tour.`,
      );
      poseCooldown(e_cible);
    },
  },
  {
    nom: `posePortail`,
    declencheur: (e) => !!e.posePortail,
    resoudre: ({ lanceur, ctx, poseCooldown }) => {
      ouvrirPortail(lanceur, ctx);
      poseCooldown(lanceur);
    },
  },
  {
    nom: `paProchainTourLigne`,
    declencheur: (e) => !!e.paProchainTourLigne,
    resoudre: ({ lanceur, sort, cs, ctx, poseCooldown }) => {
      let sort_paProchainTourLigne = sort.paProchainTourLigne;
      let s =
        (lanceur.portails ?? 0) >= sort_paProchainTourLigne.seuil
          ? sort_paProchainTourLigne.valeurSeuil
          : sort_paProchainTourLigne.valeur;
      let c = alliesVivants(lanceur, cs).filter((e) => enLigneAvant(e) === enLigneAvant(lanceur));
      for (let e of c) {
        e.paBonusNextTurn += s;
      }
      ctx.log(`${lanceur.nom} lance ${sort.nom} : sa rangée gagne +${s} PA au prochain tour.`);
      poseCooldown(lanceur);
    },
  },
  {
    nom: `facesAleatoires`,
    declencheur: (e) => !!e.facesAleatoires,
    resoudre: ({ lanceur, sort, cs, ctx, poseCooldown }) => {
      let sort_facesAleatoires = sort.facesAleatoires;
      ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
      let s =
        aBonusSiCrit(sort) &&
        ctx.rng() < chanceCritique(statsEffectives(lanceur)) &&
        sort.tiragesSiCrit
          ? sort.tiragesSiCrit
          : 1;
      for (let e = 0; e < s; e++) {
        let e = sort_facesAleatoires[Math.floor(ctx.rng() * sort_facesAleatoires.length)];
        ctx.log(`${lanceur.nom} tire : ${descriptionBuff(e)}.`);
        for (let n of ciblesBouclierGroupe(lanceur, cs, e.portee)) {
          if (e.effet) {
            appliquerEffet(n, e.effet);
          }
        }
        if (e.bouclierPct) {
          bouclierGroupe(lanceur, cs, e.portee, e.bouclierPct, e.duree, ctx);
        }
      }
      poseCooldown(lanceur);
    },
  },
  {
    nom: `soutien`,
    declencheur: (e) => e.type === `buff` || e.type === `debuff`,
    resoudre: ({ lanceur, sort, cible, cs, ctx, poseCooldown }) => {
      ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
      let s = aBonusSiCrit(sort) && ctx.rng() < chanceCritique(statsEffectives(lanceur));
      for (let e of ciblesSoutien(sort, lanceur, cible, cs)) {
        appliquerSoutien(sort, e, lanceur, ctx, s);
        effetsClasseSoutien(sort, e, lanceur, cs, ctx);
        poseCooldown(e);
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
function trouverResolveur(e) {
  return RESOLVEURS_SORTS.find((t) => t.declencheur(e.sort) && (t.garde?.(e) ?? true));
}
function resoudreDegats(e) {
  let { cible } = e;
  if (!cible) {
    return;
  }
  let n = {
    ...e,
    cible,
  };
  let r = multiplicateursLancer(n);
  if (n.sort.soinLigneAvantRatio) {
    resoudreSoinLigneAvant(n, r);
    return;
  }
  let i = appliquerDegatsSort(n, r);
  propagerInfection(n.lanceur, n.sort, cible, n.cs, n.ctx);
  effetsApresDegats(n, i);
  soinsApresDegats(n, i, i.totalDmg + degatsToucheDerriere(n, r));
  effetsFinLancer(n, i);
  n.poseCooldown(cible);
}
function multiplicateursLancer({ lanceur, sort, cible, cs }) {
  let useMax = consommerMaxRoll(lanceur);
  let lanceur_bonusOffensifProchain = lanceur.bonusOffensifProchain;
  lanceur.bonusOffensifProchain = 0;
  let multLigne =
    1 +
    (lanceur.bonusParAllieLigne ?? 0) *
      alliesVivants(lanceur, cs).filter(
        (e) => e.ref !== lanceur.ref && enLigneAvant(e) === enLigneAvant(lanceur),
      ).length;
  multLigne *= bonusPortails(lanceur, cs);
  multLigne *= bonusConjuration(lanceur, cible, cs);
  if (sort.bonusParEnnemiLigneCible) {
    multLigne *=
      1 +
      sort.bonusParEnnemiLigneCible *
        ennemisVivants(lanceur, cs).filter(
          (e) => e.ref !== cible.ref && !e.estLance && enLigneAvant(e) === enLigneAvant(cible),
        ).length;
  }
  let multChausse = sort.bonusParChausseTrappe
    ? 1 + sort.bonusParChausseTrappe * Math.min(lanceur.chausseTrappe ?? 0, 5)
    : 1;
  if (sort.bonusParEnnemiToucheZone) {
    let e = ciblesTouchees(lanceur, sort, cible, cs).filter((e) => !e.estLance).length;
    multLigne *= 1 + sort.bonusParEnnemiToucheZone * e;
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
  let f = 0;
  for (let e of ciblesTouchees(lanceur, sort, cible, cs)) {
    let t = lancerAttaque(
      lanceur,
      sort,
      e,
      {
        useMax,
        mult: (1 + bonusVigueur) * multLigne,
        ctx,
        paAvant,
      },
      sort.nom,
    );
    if (!e.estLance) {
      f += t;
    }
  }
  let p = alliesVivants(lanceur, cs).filter(enLigneAvant);
  if (f > 0 && p.length) {
    let e = Math.round(((f * sort.soinLigneAvantRatio) / p.length) * multiplicateurSoinDe(lanceur));
    for (let t of p) {
      soigner(t, e, ctx);
    }
  }
  poseCooldown(cible);
}
function multiplicateurCible(sort, ref, n, r) {
  return (
    (sort.rebond ? 1 + sort.rebond.bonusParSaut * r : 1) *
    (sort.ratioLigne && n.ref !== ref ? sort.ratioLigne : 1)
  );
}
function appliquerDegatsSort(e, t) {
  let { lanceur, sort, cible, cs, ctx, paAvant, multEscalade } = e;
  let { useMax, bonusVigueur, multLigne, multChausse } = t;
  let totalDmg = 0;
  let touchees = ciblesTouchees(lanceur, sort, cible, cs);
  let h = sort.baseMax === 0 && (!!sort.deplaceCible || !!sort.conjuration);
  let nonEsquivees = new Set();
  let unCritique = false;
  touchees.forEach((a, m) => {
    if (h) {
      return;
    }
    let v = sort.ratioLigne && a.ref !== cible?.ref ? `${sort.nom} (éclaboussure)` : sort.nom;
    let mult =
      multiplicateurCible(sort, cible.ref, a, m) *
      (1 + bonusVigueur) *
      multLigne *
      multEscalade *
      multChausse;
    let y = calculerDegats(lanceur, sort, a, {
      useMax,
      mult,
      ctx,
      paAvant,
    });
    if (y.esquive) {
      ctx.log(`${a.nom} esquive ${v} !`);
      ctx.fx?.({
        type: `esquive`,
        ref: a.ref,
      });
    } else {
      if (y.crit) {
        ctx.fx?.({
          type: `crit`,
          ref: a.ref,
        });
        unCritique = true;
      }
      infligerDegats(a, y.dmg, lanceur, ctx, sort.ignoreBouclier, undefined, y.element);
      nonEsquivees.add(a.ref);
      if (!a.estLance) {
        totalDmg += y.dmg;
      }
      if (!a.estLance) {
        logDegats(
          ctx,
          `${lanceur.nom} → ${v} sur ${a.nom} : `,
          y.dmg,
          y.element,
          `${y.crit ? ` (CRIT)` : ``}.${a.pvActuels <= 0 ? ` ${a.nom} est K.O. !` : ``}`,
        );
      }
      if (a.pvActuels > 0) {
        totalDmg += effetsSurCibleTouchee(e, a, y, mult, t);
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
function effetsSurCibleTouchee({ lanceur, sort, ctx, paAvant }, t, n, mult, { useMax }) {
  let u = 0;
  effetsClasseSurCible(lanceur, sort, t, n, ctx);
  if (n.crit && n.dmg > 0 && reliquesActivesDe(lanceur, ctx).has(`dofus_forgelave`)) {
    appliquerPoison(t, { degats: Math.max(1, Math.round(n.dmg * 0.15)), duree: 2 });
    ctx.log(`🔥 Le Dofus Forgelave embrase ${t.nom}.`);
  }
  if (sort.poison) {
    appliquerPoison(t, sort.poison);
  }
  if (sort.poisonSiPortails && (lanceur.portails ?? 0) >= sort.poisonSiPortails.seuil) {
    appliquerPoison(t, {
      degats: Math.round(n.dmg * sort.poisonSiPortails.ratio),
      duree: sort.poisonSiPortails.duree,
    });
  }
  if (sort.effet) {
    appliquerEffet(
      t,
      sort.effetSiPortails && (lanceur.portails ?? 0) >= sort.effetSiPortails.seuil
        ? {
            ...sort.effet,
            valeur: sort.effetSiPortails.valeur,
          }
        : sort.effet,
    );
  }
  if (sort.retraitPAProchainTour) {
    t.paBonusNextTurn -= sort.retraitPAProchainTour;
    ctx.log(
      `${t.nom} commencera son prochain tour amputé de ${sort.retraitPAProchainTour} PA (Tétanie).`,
    );
  }
  if (sort.assome && !t.estLance && ctx.rng() < sort.assome) {
    appliquerEffet(t, {
      stat: `assome`,
      valeur: 1,
      duree: 1,
    });
    ctx.log(`💫 ${t.nom} est assommé : il passera son prochain tour !`);
  }
  if (sort.procAleatoire && sort.procAleatoire.length) {
    let e = sort.procAleatoire[Math.floor(ctx.rng() * sort.procAleatoire.length)];
    if (e.dissipePositifs) {
      desenvouter(t, ctx);
    }
    if (e.effet) {
      appliquerEffet(t, e.effet);
    }
  }
  if (sort.secondCoupSiCrit && n.crit) {
    let e = lancerAttaque(
      lanceur,
      {
        ...sort,
        elementPire: false,
        sansEsquiveNiCrit: true,
      },
      t,
      {
        useMax,
        mult,
        ctx,
        paAvant,
      },
      `${sort.nom} (retour)`,
    );
    if (!t.estLance) {
      u += e;
    }
  }
  return u;
}
function effetsApresDegats({ lanceur, sort, cible, cs, ctx }, { nonEsquivees, totalDmg }) {
  if (totalDmg > 0) {
    appliquerDofusTachete(lanceur, cs, reliquesActivesDe(lanceur, ctx));
  }
  if (sort.consommeChausseTrappe) {
    lanceur.chausseTrappe = 0;
  }
  if (sort.effetLigneCible && nonEsquivees.has(cible.ref)) {
    let e = vivants(cs).filter(
      (e) => e.camp === cible.camp && enLigneAvant(e) === enLigneAvant(cible),
    );
    for (let t of e) {
      let e = t.effets.find((e) => e.stat === sort.effetLigneCible.stat);
      if (e) {
        e.toursRestants = sort.effetLigneCible.duree;
      } else {
        appliquerEffet(t, sort.effetLigneCible);
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
function degatsToucheDerriere({ lanceur, sort, cible, cs, ctx }, t) {
  if (!sort.toucheDerriere) {
    return 0;
  }
  let s = allieDerriere(cible, cs);
  if (!s || s.pvActuels <= 0) {
    return 0;
  }
  let c = lancerAttaque(
    lanceur,
    sort,
    s,
    {
      useMax: t.useMax,
      mult: (1 + t.bonusVigueur) * t.multLigne,
      ctx,
    },
    sort.nom,
  );
  if (s.estLance) {
    return 0;
  }
  return c;
}
function soinsApresDegats({ lanceur, sort, cs, ctx }, { touchees, nonEsquivees }, n) {
  if (sort.soinAllieBlesseRatio && n > 0) {
    soignerPlusBlesse(alliesVivants(lanceur, cs), sort.soinAllieBlesseRatio, n, lanceur, ctx);
  }
  if (sort.soinAvantBlesseRatio && n > 0) {
    soignerPlusBlesse(
      alliesVivants(lanceur, cs).filter(enLigneAvant),
      sort.soinAvantBlesseRatio,
      n,
      lanceur,
      ctx,
    );
  }
  if (sort.soinEquipeRatio && n > 0) {
    let e = Math.round(n * sort.soinEquipeRatio * multiplicateurSoinDe(lanceur));
    for (let t of alliesVivants(lanceur, cs)) {
      soigner(t, e, ctx);
    }
    ctx.log(`${lanceur.nom} draine ${e} PV pour l'équipe.`);
  }
  if (sort.bouclierRatioDegats && n > 0) {
    let e = Math.round(n * sort.bouclierRatioDegats);
    lanceur.bouclier += e;
    ctx.log(`${lanceur.nom} gagne un bouclier de ${e}.`);
  }
  if (sort.bouclierParEnnemiTouche) {
    let e = touchees.filter((e) => !e.estLance && nonEsquivees.has(e.ref)).length;
    if (e > 0) {
      let t = sort.bouclierParEnnemiTouche * e;
      lanceur.bouclier += t;
      ctx.log(`${lanceur.nom} gagne un bouclier de ${t} (Hydra).`);
    }
  }
  if (sort.vampirismeRatio && n > 0) {
    soigner(lanceur, Math.round(n * sort.vampirismeRatio * multiplicateurSoinDe(lanceur)), ctx);
  }
}
function effetsFinLancer(
  { lanceur, sort, cible, cs, ctx },
  { touchees, nonEsquivees, unCritique },
) {
  if (sort.retraitPA) {
    for (let e of touchees) {
      e.pvActuels <= 0 ||
        e.estLance ||
        !nonEsquivees.has(e.ref) ||
        (ctx.rng() < (sort.retraitPAChance ?? 0.3) && retirerPA(e, sort.retraitPA, ctx));
    }
  }
  if (sort.deplaceCible && cible.pvActuels > 0) {
    let e = sort.telefragSiOccupee
      ? vivants(cs).some((e) => e.camp === cible.camp && enLigneAvant(e) !== enLigneAvant(cible))
      : false;
    let t = cible.position;
    repousser(cible, sort.deplaceCible, cs, ctx);
    if (sort.telefragSiOccupee && e && cible.position !== t && cible.pvActuels > 0) {
      poserTelefrag(cible, cs, ctx, lanceur);
      let e = vivants(cs)
        .filter(
          (e) =>
            e.camp === cible.camp && e.ref !== cible.ref && enLigneAvant(e) === enLigneAvant(cible),
        )
        .sort(
          (e, t) => Math.abs(e.position - cible.position) - Math.abs(t.position - cible.position),
        )[0];
      if (e) {
        poserTelefrag(e, cs, ctx, lanceur);
      }
    }
  }
  if (sort.effetLanceur) {
    appliquerEffet(lanceur, sort.effetLanceur);
  }
  if (sort.reduitCoutSiCrit && unCritique) {
    lanceur.remisesCout ??= {};
    let e = coutPA(sort, lanceur);
    lanceur.remisesCout[sort.id] = (lanceur.remisesCout[sort.id] ?? 0) + sort.reduitCoutSiCrit;
    let t = coutPA(sort, lanceur);
    if (t < e) {
      ctx.log(`${lanceur.nom} réduit le coût de son prochain ${sort.nom} de ${e - t} PA.`);
    }
  }
  if (sort.rage) {
    gagnerRage(lanceur, ctx);
  }
  effetsClasseFinLancer(lanceur, sort, cs, ctx);
}
export function lancerSort(e, t, n, r, i) {
  t = sortSelonEtat(e, t);
  let a = preparerLancer(e, t, n, r, i);
  if (echecCritique(a)) {
    return;
  }
  let o = trouverResolveur(a);
  if (o) {
    o.resoudre(a);
  } else {
    resoudreDegats(a);
  }
}
