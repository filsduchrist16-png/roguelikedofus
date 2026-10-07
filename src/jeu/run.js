import { CLASSES, COMBATS, EQUIPEMENTS, MONSTRES } from "../data/index.js";
import {
  AFFIXES_GROUPE,
  CONFIG_ARCHI,
  DIFFICULTES,
  MONSTRES_RARES,
  RARETES,
  RARETES_INFO,
  TAUX_BUTIN,
  butinDeZone,
  getMonde,
} from "./config.js";
import {
  STAT_PAR_ELEMENT,
  gagnerXp,
  nouvelleProgression,
  pvMaxDeNiveau,
  statsDeNiveau,
} from "./progression.js";
import { etatCombatInitial } from "../combat/stats.js";
import { chargerParametres, rangOrdre } from "../sauvegarde/parametres.js";
export const nouvellesStatsRun = () => ({
  degats: {},
  combats: 0,
  archis: 0,
  objets: 0,
  zones: 0,
  kamasGagnes: 0,
  tavernes: 0,
  recrutements: 0,
  quetes: [],
  reliques: [],
});
const EQUIPE_DEFAUT = [`iop`, `cra`, `eniripsa`, `ecaflip`];
const niveauMaxMonde = (e) => getMonde(e).niveaux[1];
export function gagnerXpPerso(e, t, n) {
  return gagnerXp(e.progression, t, niveauMaxMonde(n));
}
const CLASSES_DESACTIVEES = new Set([`sadida`]);
export const classesJouables = () =>
  Object.keys(CLASSES).filter((e) => !CLASSES_DESACTIVEES.has(e));
function positionParDefaut(e, t) {
  let n = chargerParametres().formation[e] === `arriere` ? `arriere` : `avant`;
  let r = (e) => {
    let [n, r] = e === `avant` ? [0, 4] : [4, 8];
    for (let e = n; e < r; e++) {
      if (!t.has(e)) {
        return e;
      }
    }
  };
  return r(n) ?? r(n === `avant` ? `arriere` : `avant`);
}
function positionsInitiales(e) {
  let t = {};
  let n = new Set();
  for (let r of e) {
    let e = positionParDefaut(r, n);
    t[r] = e;
    n.add(e);
  }
  return t;
}
function creerPerso(classeId, t, n) {
  let progression = nouvelleProgression();
  progression.niveau = t;
  return {
    classeId,
    progression,
    pvActuels: pvMaxDeNiveau(CLASSES[classeId], progression),
    position: n,
    equipement: {},
  };
}
function trierParOrdre(e, ordre) {
  return [...e].sort((e, n) => rangOrdre(ordre, e.classeId) - rangOrdre(ordre, n.classeId));
}
function insererSelonOrdre(persos, t, ordre) {
  let r = rangOrdre(ordre, t.classeId);
  let i = persos.findIndex((e) => rangOrdre(ordre, e.classeId) > r);
  if (i < 0) {
    persos.push(t);
  } else {
    persos.splice(i, 0, t);
  }
}
export function nouvelleRun(e = EQUIPE_DEFAUT, ascension = 0, trancheId = `t1`) {
  let r = positionsInitiales(e);
  let i = getMonde(trancheId).niveaux[0];
  return {
    persos: trierParOrdre(
      e.map((e) => {
        let t = creerPerso(e, i, r[e]);
        t.pvActuels = pvMaxPerso(t);
        return t;
      }),
      chargerParametres().ordre,
    ),
    carte: null,
    inventaire: [],
    stats: nouvellesStatsRun(),
    kamas: 0,
    choixDepart: [...e],
    ascension,
    philtres: 0,
    trancheId,
  };
}
export function noeudsExclus(e, t) {
  let n = [...(t.sansNoeuds ?? [])];
  if (
    effetsDifficulte(e.ascension).tavernesCoupeesAPlein &&
    e.persos.length >= 4 &&
    !n.includes(`taverne`)
  ) {
    n.push(`taverne`);
  }
  return n;
}
function niveauMoyen(e) {
  if (e.persos.length) {
    return Math.max(
      1,
      Math.round(
        e.persos.reduce((acc, perso) => acc + perso.progression.niveau, 0) / e.persos.length,
      ),
    );
  }
  return 1;
}
function classesRecrutables(e) {
  let t = new Set(e.persos.map((e) => e.classeId));
  return classesJouables().filter((e) => !t.has(e));
}
export function tirerRecrues(e, t) {
  let n = classesRecrutables(e);
  let r = [];
  for (let e = 0; e < 2 && n.length; e++) {
    r.push(n.splice(Math.floor(t() * n.length), 1)[0]);
  }
  return r;
}
function creerRecrue(e, t, n) {
  return creerPerso(t, niveauMoyen(e), n);
}
export function recruter(e, t, n) {
  if (n) {
    let r = e.persos.findIndex((e) => e.classeId === n);
    if (r >= 0) {
      for (let t of Object.values(e.persos[r].equipement)) {
        if (t) {
          e.inventaire.push(t);
        }
      }
      e.persos[r] = creerRecrue(e, t, e.persos[r].position);
      return;
    }
  }
  let r = creerRecrue(e, t, positionParDefaut(t, new Set(e.persos.map((e) => e.position))));
  insererSelonOrdre(e.persos, r, chargerParametres().ordre);
}
const statsVides = () => ({
  force: 0,
  intelligence: 0,
  agilite: 0,
  vitalite: 0,
  chance: 0,
  soin: 0,
  prospection: 0,
});
// additionne clé par clé les valeurs de `bonus` dans `cible` (stats, résistances…)
function additionner(cible, bonus) {
  if (bonus) {
    for (let n of Object.keys(bonus)) {
      cible[n] = (cible[n] ?? 0) + (bonus[n] ?? 0);
    }
  }
}
function proprieteEquipement(equipement, t) {
  return Object.values(equipement)
    .map((e) => e && EQUIPEMENTS[e.id]?.[t])
    .find(Boolean);
}
const ELEMENTS_RES = [`terre`, `feu`, `eau`, `air`];
export function ajouterResistanceTous(e, t) {
  for (let n of ELEMENTS_RES) {
    e.resistances[n] = (e.resistances[n] ?? 0) + t;
  }
}
function multiplierPv(e, pvMult) {
  e.pvMax = Math.round(e.pvMax * pvMult);
  e.pvBase = e.pvMax;
  e.pvActuels = e.pvMax;
}
export function compterPanoplies(e) {
  let t = {};
  for (let n of Object.values(e.equipement)) {
    let e = n && EQUIPEMENTS[n.id]?.panoplie;
    if (e) {
      t[e] = (t[e] ?? 0) + 1;
    }
  }
  return t;
}
export function bonusEquipement(e) {
  let t = statsVides();
  let pvBonus = 0;
  let paBonus = 0;
  let resistances = {};
  for (let a of Object.keys(e.equipement)) {
    let o = e.equipement[a];
    let s = o ? EQUIPEMENTS[o.id] : undefined;
    if (!(!o || !s)) {
      additionner(t, o.stats);
      if (o.adaptatif) {
        for (let n of CLASSES[e.classeId].elements) {
          let e = STAT_PAR_ELEMENT[n];
          t[e] = (t[e] ?? 0) + o.adaptatif;
        }
      }
      pvBonus += s.pvBonus ?? 0;
      paBonus += o.pa ?? 0;
      additionner(resistances, s.resistances);
      additionner(resistances, o.resistances);
    }
  }
  if (Object.values(compterPanoplies(e)).some((e) => e >= 4)) {
    paBonus += 1;
  }
  return {
    stats: t,
    pvBonus,
    resistances,
    paBonus,
  };
}
export function pvMaxPerso(e) {
  let t = bonusEquipement(e);
  return (
    pvMaxDeNiveau(CLASSES[e.classeId], e.progression) + t.pvBonus + (t.stats.vitalite ?? 0) * 1
  );
}
function creerCombattantPerso(e) {
  let t = CLASSES[e.classeId];
  let n = bonusEquipement(e);
  let r = statsDeNiveau(t, e.progression);
  additionner(r, n.stats);
  let i = pvMaxPerso(e);
  let arme = e.equipement.arme;
  let o = arme ? EQUIPEMENTS[arme.id] : undefined;
  let s = arme?.rarete ? o?.tiers?.[arme.rarete]?.attaque : undefined;
  let armeSort =
    o && s
      ? {
          id: `arme_attaque`,
          nom: o.nom,
          type: `degats`,
          cible: s.cible ?? `ennemi_ligne`,
          coutPA: s.coutPA,
          baseMin: s.baseMin,
          baseMax: s.baseMax,
          ...(s.vampirisme
            ? {
                vampirismeRatio: s.vampirisme,
              }
            : {}),
          ...(o.perceResistances
            ? {
                perceResistances: o.perceResistances,
              }
            : {}),
          ...(o.frappeDerriere
            ? {
                toucheDerriere: true,
              }
            : {}),
          ...(o.poisonArme
            ? {
                poison: o.poisonArme,
              }
            : {}),
          ...(o.soinAllieBlesse
            ? {
                soinAllieBlesseRatio: o.soinAllieBlesse,
              }
            : {}),
          ...(o.retraitPA
            ? {
                retraitPA: o.retraitPA,
              }
            : {}),
          ...(o.assome
            ? {
                assome: o.assome,
              }
            : {}),
          img: `/assets/items/${o.id}.png`,
          desc:
            s.cible === `ennemi_tous`
              ? `Attaque d'arme — atteint la ligne arrière.`
              : s.vampirisme
                ? `Attaque d'arme — rend ${Math.round(s.vampirisme * 100)} % des dégâts en PV.`
                : `Attaque d'arme.`,
        }
      : undefined;
  let l = (t) => proprieteEquipement(e.equipement, t);
  let d = l(`changeLigne`) ? [`changer_ligne`] : [];
  let renaissance = l(`renaissance`);
  let p = compterPanoplies(e);
  let m = {};
  for (let t of Object.values(e.equipement)) {
    let e = t && EQUIPEMENTS[t.id];
    if (e?.panoplie && e.esquiveParPiece) {
      m[e.panoplie] = Math.max(m[e.panoplie] ?? 0, e.esquiveParPiece);
    }
  }
  let h =
    (l(`esquiveBonus`) ?? 0) + Object.entries(m).reduce((acc, [t, n]) => acc + n * (p[t] ?? 0), 0);
  return {
    armeSort,
    paGamble: l(`paGamble`),
    recupPASort: l(`recupPASort`),
    riposteAvant: l(`riposteAvant`),
    esquiveArriere: l(`esquiveArriere`),
    esquiveBonus: h || undefined,
    soinDegatsRecus: l(`soinDegatsRecus`),
    elementLibre: l(`elementLibre`),
    renaissance,
    renaissancesRestantes: +!!renaissance,
    ref: `j_${e.classeId}`,
    nom: t.nom,
    pvBase: i,
    pvMax: i,
    pvActuels: Math.min(e.pvActuels, i),
    stats: r,
    paMax: t.pa + n.paBonus,
    paActuels: t.pa + n.paBonus,
    initiative: t.initiative,
    resistances: n.resistances,
    sorts: [...t.sorts, ...d],
    camp: `joueur`,
    position: e.position,
    niveau: e.progression.niveau,
    elements: t.elements,
    img: t.img,
    ...etatCombatInitial(),
    bouclier: Math.round(i * (l(`bouclierDebut`) ?? 0)),
  };
}
export function combattantsEquipe(e) {
  return e.persos.map((e) => creerCombattantPerso(e));
}
export function synchroniserPv(e, t) {
  for (let n of e.persos) {
    let e = t.find((e) => e.ref === `j_${n.classeId}`);
    if (e) {
      n.pvActuels = e.pvActuels;
    }
  }
}
export function soignerEquipe(e, t) {
  let n = !!effetsDifficulte(e.ascension).mortDefinitive;
  for (let r of e.persos) {
    if (n && r.pvActuels <= 0) {
      continue;
    }
    let e = pvMaxPerso(r);
    r.pvActuels = Math.min(e, r.pvActuels + Math.round(e * t));
  }
}
function tirerRarete(e, t = RARETES) {
  let n = t.reduce((acc, item) => acc + RARETES_INFO[item].poids, 0);
  let r = e() * n;
  for (let e of t) {
    r -= RARETES_INFO[e].poids;
    if (r < 0) {
      return e;
    }
  }
  return t[0];
}
export function instancierObjet(id, rarete) {
  let n = EQUIPEMENTS[id]?.tiers?.[rarete];
  if (n) {
    return {
      id,
      rarete,
      stats: {
        ...n.stats,
      },
      adaptatif: n.adaptatif,
      resistances: n.resistances,
      pa: n.pa,
    };
  }
  return null;
}
export function tirerObjet(e, t, n = RARETES) {
  let r = EQUIPEMENTS[e]?.tiers;
  if (!r) {
    return null;
  }
  let i = n.filter((e) => r[e]);
  if (i.length) {
    return instancierObjet(e, tirerRarete(t, i));
  }
  return null;
}
function tirerObjetButin(e, t) {
  return tirerObjet(e, t);
}
export function prospectionEquipe(e) {
  return e.persos.reduce((acc, perso) => {
    let n = statsDeNiveau(CLASSES[perso.classeId], perso.progression).prospection ?? 0;
    let r = proprieteEquipement(perso.equipement, `prospParPvManquant`);
    let i = r ? Math.round(r * Math.max(0, pvMaxPerso(perso) - perso.pvActuels)) : 0;
    return acc + n + (bonusEquipement(perso).stats.prospection ?? 0) + i;
  }, 0);
}
export function multiplicateurKamas(e) {
  return e.persos.reduce((acc, perso) => {
    for (let n of Object.values(perso.equipement)) {
      let t = n && EQUIPEMENTS[n.id]?.multKamas;
      if (t) {
        acc *= t;
      }
    }
    return acc;
  }, 1);
}
export function tirerButin(e, t, n, r, i = n, a = 0) {
  let o = TAUX_BUTIN.taux[i] ?? 0;
  if (o <= 0) {
    return [];
  }
  let s =
    o *
    (1 +
      Math.min(TAUX_BUTIN.capProspection, (prospectionEquipe(e) + a) * TAUX_BUTIN.coefProspection));
  let c = [];
  let l = butinDeZone(t);
  if (!l) {
    return [];
  }
  let l_normales = l.normales;
  for (let t = 0; t < Math.min(Math.max(l_normales.length, 1), 4); t++) {
    if (r() < s) {
      let i = l_normales;
      t === 0 &&
        (n === `donjon` && l.boss.length
          ? (i = l.boss)
          : n === `combat_dur` && l.elites.length && (i = l.elites));
      if (!i.length) {
        continue;
      }
      let a = i[Math.floor(r() * i.length)];
      let o = tirerObjetButin(a, r);
      e.inventaire.push(o);
      c.push(o);
    }
  }
  return c;
}
export function peutEquiper(e, t) {
  let n = EQUIPEMENTS[t];
  return !(!n || (n.ligneAvant && e.position >= 4));
}
export function equiperObjet(e, t, n) {
  let r = e[n];
  let i = r ? EQUIPEMENTS[r.id] : undefined;
  if (!r || !i || !peutEquiper(t, r.id)) {
    return;
  }
  e.splice(n, 1);
  let a = t.equipement[i.slot];
  if (a) {
    e.push(a);
  }
  t.equipement[i.slot] = r;
  t.pvActuels = Math.min(t.pvActuels, pvMaxPerso(t));
}
export function desequiper(e, t, n) {
  let r = t.equipement[n];
  if (r) {
    delete t.equipement[n];
    e.push(r);
    t.pvActuels = Math.min(t.pvActuels, pvMaxPerso(t));
  }
}
function creerMonstre(e, ref, n) {
  return {
    ref,
    nom: e.nom,
    pvBase: e.pv,
    pvMax: e.pv,
    pvActuels: e.pv,
    stats: {
      ...e.stats,
    },
    paMax: e.pa,
    paActuels: e.pa,
    initiative: e.initiative,
    resistances: {
      ...e.resistances,
    },
    sorts: [...e.sorts],
    camp: `ennemi`,
    position: n,
    niveau: 1,
    monstreId: e.id,
    archiNom: e.archiNom,
    ia: e.ia,
    mueElementaire: e.mueElementaire,
    bonusParAllieLigne: e.bonusParAllieLigne,
    armure: e.armure,
    nullifieParTour: e.nullifieParTour,
    coupsAnnulesRestants: e.nullifieParTour,
    img: e.img,
    ...etatCombatInitial(),
  };
}
export function monstresDuCombat(e) {
  return COMBATS[e].ennemis.map((e, t) =>
    creerMonstre(MONSTRES[e.monstre], `e${t}_${e.monstre}`, e.position),
  );
}
function appliquerAffixe(e, t, n) {
  let r =
    AFFIXES_GROUPE.find((e) => e.id === n) ??
    AFFIXES_GROUPE[Math.floor(t() * AFFIXES_GROUPE.length)];
  for (let t of e) {
    if (r.statMult) {
      let e = t.stats;
      t.stats = {
        ...e,
        force: Math.round(e.force * r.statMult),
        intelligence: Math.round(e.intelligence * r.statMult),
        agilite: Math.round(e.agilite * r.statMult),
        chance: Math.round((e.chance ?? 0) * r.statMult),
      };
    }
    if (r.pvMult) {
      multiplierPv(t, r.pvMult);
    }
    if (r.resAll) {
      ajouterResistanceTous(t, r.resAll);
    }
    if (r.initBonus) {
      t.initiative += r.initBonus;
    }
    if (r.paBonus) {
      t.paMax += r.paBonus;
      t.paActuels = t.paMax;
    }
  }
  return r;
}
export function appliquerAffixesElite(e, t, n) {
  let r =
    (n ?? []).map((e) => AFFIXES_GROUPE.find((t) => t.id === e)).find((e) => e !== undefined) ??
    AFFIXES_GROUPE[Math.floor(t() * AFFIXES_GROUPE.length)];
  appliquerAffixe(e, t, r.id);
  return [r];
}
export function especesNormalesZone(e) {
  let t = new Set();
  for (let n of e.pools.normales) {
    for (let e of COMBATS[n]?.ennemis ?? []) {
      t.add(e.monstre);
    }
  }
  return [...t];
}
export function appliquerDifficulteMonstres(e, t, n) {
  let r = n.type === `combat` || n.type === `combat_dur`;
  if (t.renfortAvant && r && n.especesZone?.length) {
    let t = new Set(e.map((e) => e.position));
    let r = [0, 1, 2, 3].find((e) => !t.has(e));
    if (r !== undefined) {
      let t = n.especesZone[Math.floor(n.rng() * n.especesZone.length)];
      e.push(creerMonstre(MONSTRES[t], `asc_${t}`, r));
    }
  }
  if (t.pvMult) {
    for (let n of e) {
      multiplierPv(n, t.pvMult);
    }
  }
}
export function effetsDifficulte(e) {
  return DIFFICULTES[Math.max(0, Math.min(Math.trunc(e) || 0, DIFFICULTES.length - 1))].effets;
}
export function chanceArchi(e) {
  return (
    CONFIG_ARCHI.chance + CONFIG_ARCHI.philtre * Math.min(e.philtres ?? 0, CONFIG_ARCHI.philtresMax)
  );
}
function transformerEnArchi(e) {
  if (e.archi || !e.archiNom) {
    return;
  }
  e.archi = true;
  e.nom = e.archiNom;
  multiplierPv(e, CONFIG_ARCHI.pvMult);
  let e_stats = e.stats;
  e.stats = {
    force: Math.round(e_stats.force * CONFIG_ARCHI.statMult),
    intelligence: Math.round(e_stats.intelligence * CONFIG_ARCHI.statMult),
    agilite: Math.round(e_stats.agilite * CONFIG_ARCHI.statMult),
    vitalite: Math.round(e_stats.vitalite * CONFIG_ARCHI.statMult),
    chance: Math.round((e_stats.chance ?? 0) * CONFIG_ARCHI.statMult),
  };
}
export function tirerArchis(e, t, n = CONFIG_ARCHI.chance) {
  for (let r of e) {
    r.archiNom && (t() >= n || transformerEnArchi(r));
  }
}
export function tirerMonstreRare(e, t, n) {
  if (n.type !== `combat`) {
    return;
  }
  let r = MONSTRES_RARES[n.tranche];
  if (!r?.especes.length || t() >= r.chance) {
    return;
  }
  let i = new Set(e.map((e) => e.position));
  let a = [0, 1, 2, 3, 4, 5, 6, 7].find((e) => !i.has(e));
  if (a === undefined) {
    return;
  }
  let o = r.especes[Math.floor(t() * r.especes.length)];
  let s = creerMonstre(MONSTRES[o], `err_${o}`, a);
  transformerEnArchi(s);
  e.push(s);
  return s.nom;
}
