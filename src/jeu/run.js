import {
  AJUSTEMENTS_DONJONS,
  AJUSTEMENTS_ZONES,
  CLASSES,
  COMBATS,
  EQUIPEMENTS,
  MONSTRES,
} from "../data/index.js";
import {
  AFFIXES_GROUPE,
  CONFIG_ARCHI,
  DIFFICULTES,
  MONSTRES_RARES,
  RARETES,
  RARETES_INFO,
  RECUPERATION,
  TAUX_BUTIN,
  butinDeZone,
  facteurType,
  getMonde,
  monstresDeZone,
  trouverZoneDansMonde,
  zonesDuMonde,
} from "./config.js";
import {
  STAT_PAR_ELEMENT,
  gagnerXp,
  nouvelleProgression,
  pvMaxDeNiveau,
  statsDeNiveau,
} from "./progression.js";
import { etatCombatInitial } from "../combat/stats.js";
import { bonusPanoplie, compterPanoplies } from "./panoplies.js";
import { PA_MAX_EQUIPEMENT, PA_MAX_PANOPLIES, emplacementsDuType } from "./emplacements.js";
export { compterPanoplies };
import { chargerParametres, rangOrdre } from "../sauvegarde/parametres.js";
export const nouvellesStatsRun = () => ({
  degats: {},
  combats: 0,
  archis: 0,
  objets: 0,
  // objets obtenus ({ id, rarete }) et ennemis vaincus : absents des anciennes sauvegardes
  butin: [],
  ennemis: 0,
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
// Vrai si le héros est encore sous le niveau maximum du monde (il peut donc gagner de l'XP).
export function peutGagnerXp(perso, trancheId) {
  return perso.progression.niveau < niveauMaxMonde(trancheId);
}
const CLASSES_DESACTIVEES = new Set();
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
// Héros encore debout (les tombés de la mort définitive ne comptent pas pour l'équipe « pleine »).
export const herosVivants = (e) => e.persos.filter((p) => p.pvActuels > 0).length;
// Aucune espèce du monde n'a d'archimonstre (Monde 5) : Otomai et le Philtre n'ont aucun effet.
export function mondeSansArchimonstre(trancheId) {
  const monde = getMonde(trancheId);
  if (MONSTRES_RARES[monde.id]?.especes?.some((id) => MONSTRES[id]?.archiNom)) {
    return false;
  }
  return !zonesDuMonde(monde).some(
    (z) => z && monstresDeZone(z).some((id) => MONSTRES[id]?.archiNom),
  );
}
export function noeudsExclus(e, t) {
  let n = [...(t.sansNoeuds ?? [])];
  if (
    effetsDifficulte(e.ascension).tavernesCoupeesAPlein &&
    herosVivants(e) >= 4 &&
    !n.includes(`taverne`)
  ) {
    n.push(`taverne`);
  }
  // philtres d'Otomai plafonnés : plus d'Otomai une fois le maximum atteint
  // pas d'Otomai non plus dans un monde sans archimonstre
  if (
    ((e.philtres ?? 0) >= CONFIG_ARCHI.philtresMax || mondeSansArchimonstre(e.trancheId)) &&
    !n.includes(`otomai`)
  ) {
    n.push(`otomai`);
  }
  return n;
}
export function niveauMoyen(e) {
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
// Plusieurs objets portant le même effet : le plus fort l'emporte (valeurs numériques) ; pour un
// effet composé (objet), le premier trouvé est gardé.
function proprieteEquipement(equipement, t) {
  const valeurs = Object.values(equipement)
    .map((e) => e && EQUIPEMENTS[e.id]?.[t])
    .filter(Boolean);
  if (valeurs.length && valeurs.every((v) => typeof v === `number`)) {
    return Math.max(...valeurs);
  }
  return valeurs[0];
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
  // bonus de panoplie (palier atteint) ; leurs PA ne se cumulent pas
  let paPanoplies = 0;
  for (let [nom, nb] of Object.entries(compterPanoplies(e))) {
    let b = bonusPanoplie(nom, nb);
    if (!b) {
      continue;
    }
    additionner(t, b.stats);
    if (b.adaptatif) {
      for (let el of CLASSES[e.classeId].elements) {
        let st = STAT_PAR_ELEMENT[el];
        t[st] = (t[st] ?? 0) + b.adaptatif;
      }
    }
    additionner(resistances, b.resistances);
    paPanoplies += b.pa ?? 0;
  }
  paBonus = Math.min(PA_MAX_EQUIPEMENT, paBonus + Math.min(PA_MAX_PANOPLIES, paPanoplies));
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
export function creerCombattantPerso(e) {
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
    // passifs et état de départ des classes (Sacrieur, Pandawa…)
    souffrance: t.souffrance,
    etatClasse: t.etatInitial,
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
// Aperçu d'un soin de taverne : PV rendus au total et héros K.O. relevés (même calcul que soignerEquipe).
export function apercuSoin(persos, t, mortDefinitive = false) {
  let total = 0;
  let releves = [];
  for (let p of persos) {
    if (mortDefinitive && p.pvActuels <= 0) {
      continue;
    }
    let max = pvMaxPerso(p);
    let gain = Math.min(max, p.pvActuels + Math.round(max * t)) - p.pvActuels;
    if (gain > 0) {
      total += gain;
      if (p.pvActuels <= 0) {
        releves.push(p.classeId);
      }
    }
  }
  return { total, releves };
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
// Récupération après une victoire : seuls les héros debout en profitent.
export function recupererApresVictoire(e) {
  for (let p of e.persos) {
    if (p.pvActuels > 0) {
      let max = pvMaxPerso(p);
      p.pvActuels = Math.min(max, p.pvActuels + Math.round(max * RECUPERATION.victoire));
    }
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
    // passif de classe (Enutrof)
    acc *= CLASSES[perso.classeId]?.multKamas ?? 1;
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
  for (let t = 0; t < Math.min(Math.max(l_normales.length, 1), TAUX_BUTIN.tiragesMax); t++) {
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
// Valeur approximative de l'équipement d'un héros, pour choisir quel anneau remplacer.
function valeurEquipement(perso) {
  const b = bonusEquipement(perso);
  const el = CLASSES[perso.classeId].elements.map((x) => b.stats[STAT_PAR_ELEMENT[x]] ?? 0);
  const res = Object.values(b.resistances).reduce((a, v) => a + v, 0);
  return (
    Math.max(0, ...el) +
    (b.stats.vitalite ?? 0) * 0.5 +
    (b.stats.crit ?? 0) * 2 +
    (b.stats.soin ?? 0) * 0.5 +
    res * 100 +
    b.paBonus * 60
  );
}
/**
 * Emplacement où irait l'objet `inst` sur `perso` : celui de son type, ou pour un anneau, un
 * emplacement libre, sinon celui qui fait le moins perdre. Deux anneaux identiques d'une même
 * panoplie ne se portent pas ensemble (comme dans Dofus) : on remplace alors celui déjà porté.
 */
export function emplacementCible(perso, inst) {
  const def = EQUIPEMENTS[inst?.id];
  const choix = emplacementsDuType(def?.slot);
  if (choix.length <= 1) {
    return choix[0];
  }
  if (def.panoplie) {
    const double = choix.find((k) => perso.equipement[k]?.id === inst.id);
    if (double) {
      return double;
    }
  }
  const libre = choix.find((k) => !perso.equipement[k]);
  if (libre) {
    return libre;
  }
  let meilleur = choix[0];
  let max = -Infinity;
  for (const k of choix) {
    const v = valeurEquipement({ ...perso, equipement: { ...perso.equipement, [k]: inst } });
    if (v > max) {
      max = v;
      meilleur = k;
    }
  }
  return meilleur;
}
/** Peut-on mettre `inst` dans cet emplacement précis ? */
export function emplacementPossible(perso, inst, emplacement) {
  const def = EQUIPEMENTS[inst?.id];
  if (!def || !emplacementsDuType(def.slot).includes(emplacement)) {
    return false;
  }
  // pas deux anneaux identiques d'une même panoplie
  return !(
    def.panoplie &&
    emplacementsDuType(def.slot).some(
      (k) => k !== emplacement && perso.equipement[k]?.id === inst.id,
    )
  );
}
export function equiperObjet(e, t, n, emplacement) {
  let r = e[n];
  let i = r ? EQUIPEMENTS[r.id] : undefined;
  if (!r || !i || !peutEquiper(t, r.id)) {
    return;
  }
  let k = emplacement ?? emplacementCible(t, r);
  if (!k || !emplacementPossible(t, r, k)) {
    return;
  }
  e.splice(n, 1);
  let a = t.equipement[k];
  if (a) {
    e.push(a);
  }
  t.equipement[k] = r;
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
// Puissance des monstres d'une zone (src/data/ajustementsZones.json, réglée par simulation) : PV et
// dégâts multipliés par le même facteur.
function facteurTypeZone(type, zoneId) {
  const t = trouverZoneDansMonde(zoneId);
  let f = facteurType(type, t?.index ?? 0, t?.tranche.zones.length ?? 12);
  if (type === `donjon`) {
    f *= AJUSTEMENTS_DONJONS[zoneId] ?? 1;
  }
  return f;
}
export const puissanceZone = (zoneId) => AJUSTEMENTS_ZONES[zoneId] ?? 1;
export function appliquerPuissanceZone(monstres, zoneId, type) {
  // facteur de la zone × facteur du type de combat (normal / difficile / donjon)
  let f = puissanceZone(zoneId) * facteurTypeZone(type, zoneId);
  if (f === 1) {
    return;
  }
  for (let m of monstres) {
    multiplierPv(m, f);
    for (let st of [`force`, `intelligence`, `agilite`, `chance`]) {
      if (m.stats[st] !== undefined) {
        // dégâts ∝ (1 + 0,03 × stat) : on multiplie ce terme par f
        m.stats[st] = Math.max(0, Math.round(((1 + 0.03 * m.stats[st]) * f - 1) / 0.03));
      }
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
// Bonus de la jauge de traque après `n` combats sans archimonstre inédit.
export const bonusJaugeArchi = (n) =>
  Math.min(CONFIG_ARCHI.bonusSansNouveauMax, CONFIG_ARCHI.bonusParCombatSansNouveau * (n ?? 0));
// Chance qu'un archimonstre encore jamais capturé apparaisse : bien plus haute, et grandit à chaque
// combat sans nouvel archi (jauge de traque, gardée d'une run à l'autre).
export function chanceArchiNouveau(e, combatsSansNouveau = 0) {
  return Math.min(
    0.6,
    chanceArchi(e) * CONFIG_ARCHI.multNouveau + bonusJaugeArchi(combatsSansNouveau),
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
/**
 * Transforme au hasard des monstres en archimonstres. `captures` (facultatif) : espèces déjà
 * capturées ; les autres utilisent `chanceNouveau`. Renvoie true si un archi encore jamais capturé
 * est apparu.
 */
export function tirerArchis(e, t, n = CONFIG_ARCHI.chance, captures, chanceNouveau = n) {
  let nouveau = false;
  for (let r of e) {
    if (!r.archiNom) {
      continue;
    }
    const inedit = captures !== undefined && !captures.has(r.monstreId);
    if (t() < (inedit ? chanceNouveau : n)) {
      transformerEnArchi(r);
      nouveau ||= inedit;
    }
  }
  return nouveau;
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
