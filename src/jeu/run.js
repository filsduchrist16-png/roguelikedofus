import {
  AJUSTEMENTS_DONJONS,
  AJUSTEMENTS_ZONES,
  CLASSES,
  COMBATS,
  EQUIPEMENTS,
  MONSTRES,
} from "../data/index.js";
import { idolesDepartValides } from "./idolesDepart.js";
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
import { valeurEquipement } from "./evaluation.js";
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
const niveauMaxMonde = (mondeId) => getMonde(mondeId).niveaux[1];
export function gagnerXpPerso(perso, xp, mondeId) {
  return gagnerXp(perso.progression, xp, niveauMaxMonde(mondeId));
}
// Vrai si le héros est encore sous le niveau maximum du monde (il peut donc gagner de l'XP).
export function peutGagnerXp(perso, trancheId) {
  return perso.progression.niveau < niveauMaxMonde(trancheId);
}
const CLASSES_DESACTIVEES = new Set();
export const classesJouables = () =>
  Object.keys(CLASSES).filter((classeId) => !CLASSES_DESACTIVEES.has(classeId));
function positionParDefaut(classeId, prises) {
  let rangee = chargerParametres().formation[classeId] === `arriere` ? `arriere` : `avant`;
  let premierLibre = (ligne) => {
    let [debut, fin] = ligne === `avant` ? [0, 4] : [4, 8];
    for (let position = debut; position < fin; position++) {
      if (!prises.has(position)) {
        return position;
      }
    }
  };
  return premierLibre(rangee) ?? premierLibre(rangee === `avant` ? `arriere` : `avant`);
}
function positionsInitiales(classes) {
  let positions = {};
  let prises = new Set();
  for (let classeId of classes) {
    let position = positionParDefaut(classeId, prises);
    positions[classeId] = position;
    prises.add(position);
  }
  return positions;
}
function creerPerso(classeId, niveau, position) {
  let progression = nouvelleProgression();
  progression.niveau = niveau;
  return {
    classeId,
    progression,
    pvActuels: pvMaxDeNiveau(CLASSES[classeId], progression),
    position,
    equipement: {},
  };
}
function trierParOrdre(persos, ordre) {
  return [...persos].sort(
    (premier, second) => rangOrdre(ordre, premier.classeId) - rangOrdre(ordre, second.classeId),
  );
}
function insererSelonOrdre(persos, perso, ordre) {
  let rang = rangOrdre(ordre, perso.classeId);
  let indice = persos.findIndex((existant) => rangOrdre(ordre, existant.classeId) > rang);
  if (indice < 0) {
    persos.push(perso);
  } else {
    persos.splice(indice, 0, perso);
  }
}
export function nouvelleRun(
  classes = EQUIPE_DEFAUT,
  ascension = 0,
  trancheId = `t1`,
  idolesDepart = [],
  jour = null,
) {
  let positions = positionsInitiales(classes);
  let niveau = getMonde(trancheId).niveaux[0];
  return {
    persos: trierParOrdre(
      classes.map((classeId) => {
        let perso = creerPerso(classeId, niveau, positions[classeId]);
        perso.pvActuels = pvMaxPerso(perso);
        return perso;
      }),
      chargerParametres().ordre,
    ),
    carte: null,
    inventaire: [],
    stats: nouvellesStatsRun(),
    kamas: 0,
    choixDepart: [...classes],
    ascension,
    philtres: 0,
    trancheId,
    idolesDepart: idolesDepartValides(idolesDepart),
    // run du jour : date de la graine et bénédiction imposée (absents = run normale)
    ...(jour ? { jour: jour.date, benedictions: [jour.benediction] } : {}),
  };
}
// Héros encore debout (les tombés de la mort définitive ne comptent pas pour l'équipe « pleine »).
export const herosVivants = (run) => run.persos.filter((perso) => perso.pvActuels > 0).length;
// Aucune espèce du monde n'a d'archimonstre (Monde 5) : Otomai et le Philtre n'ont aucun effet.
export function mondeSansArchimonstre(trancheId) {
  const monde = getMonde(trancheId);
  if (MONSTRES_RARES[monde.id]?.especes?.some((id) => MONSTRES[id]?.archiNom)) {
    return false;
  }
  return !zonesDuMonde(monde).some(
    (zone) => zone && monstresDeZone(zone).some((id) => MONSTRES[id]?.archiNom),
  );
}
export function noeudsExclus(run, zone) {
  let exclus = [...(zone.sansNoeuds ?? [])];
  if (
    effetsDifficulte(run.ascension).tavernesCoupeesAPlein &&
    herosVivants(run) >= 4 &&
    !exclus.includes(`taverne`)
  ) {
    exclus.push(`taverne`);
  }
  // philtres d'Otomai plafonnés : plus d'Otomai une fois le maximum atteint
  // pas d'Otomai non plus dans un monde sans archimonstre
  if (
    ((run.philtres ?? 0) >= CONFIG_ARCHI.philtresMax || mondeSansArchimonstre(run.trancheId)) &&
    !exclus.includes(`otomai`)
  ) {
    exclus.push(`otomai`);
  }
  return exclus;
}
export function niveauMoyen(run) {
  if (run.persos.length) {
    return Math.max(
      1,
      Math.round(
        run.persos.reduce((acc, perso) => acc + perso.progression.niveau, 0) / run.persos.length,
      ),
    );
  }
  return 1;
}
function classesRecrutables(run) {
  let presentes = new Set(run.persos.map((perso) => perso.classeId));
  return classesJouables().filter((classeId) => !presentes.has(classeId));
}
export function tirerRecrues(run, rng) {
  let recrutables = classesRecrutables(run);
  let recrues = [];
  for (let tirage = 0; tirage < 2 && recrutables.length; tirage++) {
    recrues.push(recrutables.splice(Math.floor(rng() * recrutables.length), 1)[0]);
  }
  return recrues;
}
function creerRecrue(run, classeId, position) {
  return creerPerso(classeId, niveauMoyen(run), position);
}
export function recruter(run, classeId, remplace) {
  if (remplace) {
    let indice = run.persos.findIndex((perso) => perso.classeId === remplace);
    if (indice >= 0) {
      for (let objet of Object.values(run.persos[indice].equipement)) {
        if (objet) {
          run.inventaire.push(objet);
        }
      }
      run.persos[indice] = creerRecrue(run, classeId, run.persos[indice].position);
      return;
    }
  }
  let recrue = creerRecrue(
    run,
    classeId,
    positionParDefaut(classeId, new Set(run.persos.map((perso) => perso.position))),
  );
  insererSelonOrdre(run.persos, recrue, chargerParametres().ordre);
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
    for (let cle of Object.keys(bonus)) {
      cible[cle] = (cible[cle] ?? 0) + (bonus[cle] ?? 0);
    }
  }
}
// Plusieurs objets portant le même effet : le plus fort l'emporte (valeurs numériques) ; pour un
// effet composé (objet), le premier trouvé est gardé.
function proprieteEquipement(equipement, propriete) {
  const valeurs = Object.values(equipement)
    .map((objet) => objet && EQUIPEMENTS[objet.id]?.[propriete])
    .filter(Boolean);
  if (valeurs.length && valeurs.every((valeur) => typeof valeur === `number`)) {
    return Math.max(...valeurs);
  }
  return valeurs[0];
}
const ELEMENTS_RES = [`terre`, `feu`, `eau`, `air`];
export function ajouterResistanceTous(combattant, valeur) {
  for (let element of ELEMENTS_RES) {
    combattant.resistances[element] = (combattant.resistances[element] ?? 0) + valeur;
  }
}
function multiplierPv(combattant, pvMult) {
  combattant.pvMax = Math.round(combattant.pvMax * pvMult);
  combattant.pvBase = combattant.pvMax;
  combattant.pvActuels = combattant.pvMax;
}
export function bonusEquipement(perso) {
  let stats = statsVides();
  let pvBonus = 0;
  let paBonus = 0;
  let resistances = {};
  for (let emplacement of Object.keys(perso.equipement)) {
    let objet = perso.equipement[emplacement];
    let def = objet ? EQUIPEMENTS[objet.id] : undefined;
    if (!(!objet || !def)) {
      additionner(stats, objet.stats);
      if (objet.adaptatif) {
        for (let element of CLASSES[perso.classeId].elements) {
          let stat = STAT_PAR_ELEMENT[element];
          stats[stat] = (stats[stat] ?? 0) + objet.adaptatif;
        }
      }
      pvBonus += def.pvBonus ?? 0;
      paBonus += objet.pa ?? 0;
      additionner(resistances, def.resistances);
      additionner(resistances, objet.resistances);
    }
  }
  // bonus de panoplie (palier atteint) ; leurs PA ne se cumulent pas
  let paPanoplies = 0;
  for (let [nom, nb] of Object.entries(compterPanoplies(perso))) {
    let bonusPano = bonusPanoplie(nom, nb);
    if (!bonusPano) {
      continue;
    }
    additionner(stats, bonusPano.stats);
    if (bonusPano.adaptatif) {
      for (let el of CLASSES[perso.classeId].elements) {
        let st = STAT_PAR_ELEMENT[el];
        stats[st] = (stats[st] ?? 0) + bonusPano.adaptatif;
      }
    }
    additionner(resistances, bonusPano.resistances);
    paPanoplies += bonusPano.pa ?? 0;
  }
  paBonus = Math.min(PA_MAX_EQUIPEMENT, paBonus + Math.min(PA_MAX_PANOPLIES, paPanoplies));
  return {
    stats,
    pvBonus,
    resistances,
    paBonus,
  };
}
export function pvMaxPerso(perso) {
  let bonus = bonusEquipement(perso);
  return (
    pvMaxDeNiveau(CLASSES[perso.classeId], perso.progression) +
    bonus.pvBonus +
    (bonus.stats.vitalite ?? 0) * 1
  );
}
export function creerCombattantPerso(perso) {
  let classe = CLASSES[perso.classeId];
  let bonusEquip = bonusEquipement(perso);
  let stats = statsDeNiveau(classe, perso.progression);
  additionner(stats, bonusEquip.stats);
  let pvMax = pvMaxPerso(perso);
  let arme = perso.equipement.arme;
  let defArme = arme ? EQUIPEMENTS[arme.id] : undefined;
  let attaque = arme?.rarete ? defArme?.tiers?.[arme.rarete]?.attaque : undefined;
  let armeSort =
    defArme && attaque
      ? {
          id: `arme_attaque`,
          nom: defArme.nom,
          type: `degats`,
          cible: attaque.cible ?? `ennemi_ligne`,
          coutPA: attaque.coutPA,
          baseMin: attaque.baseMin,
          baseMax: attaque.baseMax,
          ...(attaque.vampirisme
            ? {
                vampirismeRatio: attaque.vampirisme,
              }
            : {}),
          ...(defArme.perceResistances
            ? {
                perceResistances: defArme.perceResistances,
              }
            : {}),
          ...(defArme.frappeDerriere
            ? {
                toucheDerriere: true,
              }
            : {}),
          ...(defArme.poisonArme
            ? {
                poison: defArme.poisonArme,
              }
            : {}),
          ...(defArme.soinAllieBlesse
            ? {
                soinAllieBlesseRatio: defArme.soinAllieBlesse,
              }
            : {}),
          ...(defArme.retraitPA
            ? {
                retraitPA: defArme.retraitPA,
              }
            : {}),
          ...(defArme.assome
            ? {
                assome: defArme.assome,
              }
            : {}),
          img: `/assets/items/${defArme.id}.png`,
          desc:
            attaque.cible === `ennemi_tous`
              ? `Attaque d'arme — atteint la ligne arrière.`
              : attaque.vampirisme
                ? `Attaque d'arme — rend ${Math.round(attaque.vampirisme * 100)} % des dégâts en PV.`
                : `Attaque d'arme.`,
        }
      : undefined;
  let propriete = (cle) => proprieteEquipement(perso.equipement, cle);
  let sortsPlus = propriete(`changeLigne`) ? [`changer_ligne`] : [];
  let renaissance = propriete(`renaissance`);
  let panoplies = compterPanoplies(perso);
  let esquiveParPano = {};
  for (let objet of Object.values(perso.equipement)) {
    let def = objet && EQUIPEMENTS[objet.id];
    if (def?.panoplie && def.esquiveParPiece) {
      esquiveParPano[def.panoplie] = Math.max(
        esquiveParPano[def.panoplie] ?? 0,
        def.esquiveParPiece,
      );
    }
  }
  let esquive =
    (propriete(`esquiveBonus`) ?? 0) +
    Object.entries(esquiveParPano).reduce(
      (acc, [panoplie, valeur]) => acc + valeur * (panoplies[panoplie] ?? 0),
      0,
    );
  return {
    armeSort,
    paGamble: propriete(`paGamble`),
    recupPASort: propriete(`recupPASort`),
    riposteAvant: propriete(`riposteAvant`),
    esquiveArriere: propriete(`esquiveArriere`),
    esquiveBonus: esquive || undefined,
    soinDegatsRecus: propriete(`soinDegatsRecus`),
    elementLibre: propriete(`elementLibre`),
    renaissance,
    renaissancesRestantes: +!!renaissance,
    // passifs et état de départ des classes (Sacrieur, Pandawa…)
    souffrance: classe.souffrance,
    etatClasse: classe.etatInitial,
    ref: `j_${perso.classeId}`,
    nom: classe.nom,
    pvBase: pvMax,
    pvMax,
    pvActuels: Math.min(perso.pvActuels, pvMax),
    stats,
    paMax: classe.pa + bonusEquip.paBonus,
    paActuels: classe.pa + bonusEquip.paBonus,
    initiative: classe.initiative,
    resistances: bonusEquip.resistances,
    sorts: [...classe.sorts, ...sortsPlus],
    camp: `joueur`,
    position: perso.position,
    niveau: perso.progression.niveau,
    elements: classe.elements,
    img: classe.img,
    ...etatCombatInitial(),
    bouclier: Math.round(pvMax * (propriete(`bouclierDebut`) ?? 0)),
  };
}
export function combattantsEquipe(run) {
  return run.persos.map((perso) => creerCombattantPerso(perso));
}
export function synchroniserPv(run, combattants) {
  for (let perso of run.persos) {
    let combattant = combattants.find((candidat) => candidat.ref === `j_${perso.classeId}`);
    if (combattant) {
      perso.pvActuels = combattant.pvActuels;
    }
  }
}
// Aperçu d'un soin de taverne : PV rendus au total et héros K.O. relevés (même calcul que soignerEquipe).
export function apercuSoin(persos, pct, mortDefinitive = false) {
  let total = 0;
  let releves = [];
  for (let perso of persos) {
    if (mortDefinitive && perso.pvActuels <= 0) {
      continue;
    }
    let max = pvMaxPerso(perso);
    let gain = Math.min(max, perso.pvActuels + Math.round(max * pct)) - perso.pvActuels;
    if (gain > 0) {
      total += gain;
      if (perso.pvActuels <= 0) {
        releves.push(perso.classeId);
      }
    }
  }
  return { total, releves };
}
export function soignerEquipe(run, pct) {
  let mortDefinitive = !!effetsDifficulte(run.ascension).mortDefinitive;
  for (let perso of run.persos) {
    if (mortDefinitive && perso.pvActuels <= 0) {
      continue;
    }
    let max = pvMaxPerso(perso);
    perso.pvActuels = Math.min(max, perso.pvActuels + Math.round(max * pct));
  }
}
// Récupération après une victoire : seuls les héros debout en profitent.
export function recupererApresVictoire(run) {
  for (let perso of run.persos) {
    if (perso.pvActuels > 0) {
      let max = pvMaxPerso(perso);
      perso.pvActuels = Math.min(max, perso.pvActuels + Math.round(max * RECUPERATION.victoire));
    }
  }
}
function tirerRarete(rng, raretes = RARETES) {
  let total = raretes.reduce((acc, item) => acc + RARETES_INFO[item].poids, 0);
  let tirage = rng() * total;
  for (let rarete of raretes) {
    tirage -= RARETES_INFO[rarete].poids;
    if (tirage < 0) {
      return rarete;
    }
  }
  return raretes[0];
}
export function instancierObjet(id, rarete) {
  let tier = EQUIPEMENTS[id]?.tiers?.[rarete];
  if (tier) {
    return {
      id,
      rarete,
      stats: {
        ...tier.stats,
      },
      adaptatif: tier.adaptatif,
      resistances: tier.resistances,
      pa: tier.pa,
    };
  }
  return null;
}
export function tirerObjet(id, rng, raretes = RARETES) {
  let tiers = EQUIPEMENTS[id]?.tiers;
  if (!tiers) {
    return null;
  }
  let possibles = raretes.filter((rarete) => tiers[rarete]);
  if (possibles.length) {
    return instancierObjet(id, tirerRarete(rng, possibles));
  }
  return null;
}
function tirerObjetButin(id, rng) {
  return tirerObjet(id, rng);
}
export function prospectionEquipe(run) {
  return run.persos.reduce((acc, perso) => {
    let prospection = statsDeNiveau(CLASSES[perso.classeId], perso.progression).prospection ?? 0;
    let prospParPv = proprieteEquipement(perso.equipement, `prospParPvManquant`);
    let bonusPv = prospParPv
      ? Math.round(prospParPv * Math.max(0, pvMaxPerso(perso) - perso.pvActuels))
      : 0;
    return acc + prospection + (bonusEquipement(perso).stats.prospection ?? 0) + bonusPv;
  }, 0);
}
export function multiplicateurKamas(run) {
  return run.persos.reduce((acc, perso) => {
    // passif de classe (Enutrof)
    acc *= CLASSES[perso.classeId]?.multKamas ?? 1;
    for (let objet of Object.values(perso.equipement)) {
      let mult = objet && EQUIPEMENTS[objet.id]?.multKamas;
      if (mult) {
        acc *= mult;
      }
    }
    return acc;
  }, 1);
}
export function tirerButin(run, zoneId, type, rng, typeTaux = type, prospection = 0) {
  let taux = TAUX_BUTIN.taux[typeTaux] ?? 0;
  if (taux <= 0) {
    return [];
  }
  let chance =
    taux *
    (1 +
      Math.min(
        TAUX_BUTIN.capProspection,
        (prospectionEquipe(run) + prospection) * TAUX_BUTIN.coefProspection,
      ));
  let butin = [];
  let butinZone = butinDeZone(zoneId);
  if (!butinZone) {
    return [];
  }
  let normales = butinZone.normales;
  for (
    let tirage = 0;
    tirage < Math.min(Math.max(normales.length, 1), TAUX_BUTIN.tiragesMax);
    tirage++
  ) {
    if (rng() < chance) {
      let source = normales;
      tirage === 0 &&
        (type === `donjon` && butinZone.boss.length
          ? (source = butinZone.boss)
          : type === `combat_dur` && butinZone.elites.length && (source = butinZone.elites));
      if (!source.length) {
        continue;
      }
      let id = source[Math.floor(rng() * source.length)];
      let objet = tirerObjetButin(id, rng);
      run.inventaire.push(objet);
      butin.push(objet);
    }
  }
  return butin;
}
export function peutEquiper(perso, objetId) {
  let def = EQUIPEMENTS[objetId];
  return !(!def || (def.ligneAvant && perso.position >= 4));
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
    const double = choix.find((emplacement) => perso.equipement[emplacement]?.id === inst.id);
    if (double) {
      return double;
    }
  }
  const libre = choix.find((emplacement) => !perso.equipement[emplacement]);
  if (libre) {
    return libre;
  }
  let meilleur = choix[0];
  let max = -Infinity;
  for (const emplacement of choix) {
    const valeur = valeurEquipement({
      ...perso,
      equipement: { ...perso.equipement, [emplacement]: inst },
    });
    if (valeur > max) {
      max = valeur;
      meilleur = emplacement;
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
      (autre) => autre !== emplacement && perso.equipement[autre]?.id === inst.id,
    )
  );
}
export function equiperObjet(inventaire, perso, indice, emplacement) {
  let objet = inventaire[indice];
  let def = objet ? EQUIPEMENTS[objet.id] : undefined;
  if (!objet || !def || !peutEquiper(perso, objet.id)) {
    return;
  }
  let slot = emplacement ?? emplacementCible(perso, objet);
  if (!slot || !emplacementPossible(perso, objet, slot)) {
    return;
  }
  inventaire.splice(indice, 1);
  let ancien = perso.equipement[slot];
  if (ancien) {
    inventaire.push(ancien);
  }
  perso.equipement[slot] = objet;
  perso.pvActuels = Math.min(perso.pvActuels, pvMaxPerso(perso));
}
export function desequiper(inventaire, perso, emplacement) {
  let objet = perso.equipement[emplacement];
  if (objet) {
    delete perso.equipement[emplacement];
    inventaire.push(objet);
    perso.pvActuels = Math.min(perso.pvActuels, pvMaxPerso(perso));
  }
}
function creerMonstre(def, ref, position) {
  return {
    ref,
    nom: def.nom,
    pvBase: def.pv,
    pvMax: def.pv,
    pvActuels: def.pv,
    stats: {
      ...def.stats,
    },
    paMax: def.pa,
    paActuels: def.pa,
    initiative: def.initiative,
    resistances: {
      ...def.resistances,
    },
    sorts: [...def.sorts],
    camp: `ennemi`,
    position,
    niveau: 1,
    monstreId: def.id,
    archiNom: def.archiNom,
    ia: def.ia,
    mueElementaire: def.mueElementaire,
    bonusParAllieLigne: def.bonusParAllieLigne,
    armure: def.armure,
    nullifieParTour: def.nullifieParTour,
    coupsAnnulesRestants: def.nullifieParTour,
    img: def.img,
    ...etatCombatInitial(),
  };
}
export function monstresDuCombat(combatId) {
  return COMBATS[combatId].ennemis.map((ennemi, indice) =>
    creerMonstre(MONSTRES[ennemi.monstre], `e${indice}_${ennemi.monstre}`, ennemi.position),
  );
}
function appliquerAffixe(monstres, rng, affixeId) {
  let affixe =
    AFFIXES_GROUPE.find((candidat) => candidat.id === affixeId) ??
    AFFIXES_GROUPE[Math.floor(rng() * AFFIXES_GROUPE.length)];
  for (let monstre of monstres) {
    if (affixe.statMult) {
      let stats = monstre.stats;
      monstre.stats = {
        ...stats,
        force: Math.round(stats.force * affixe.statMult),
        intelligence: Math.round(stats.intelligence * affixe.statMult),
        agilite: Math.round(stats.agilite * affixe.statMult),
        chance: Math.round((stats.chance ?? 0) * affixe.statMult),
      };
    }
    if (affixe.pvMult) {
      multiplierPv(monstre, affixe.pvMult);
    }
    if (affixe.resAll) {
      ajouterResistanceTous(monstre, affixe.resAll);
    }
    if (affixe.initBonus) {
      monstre.initiative += affixe.initBonus;
    }
    if (affixe.paBonus) {
      monstre.paMax += affixe.paBonus;
      monstre.paActuels = monstre.paMax;
    }
  }
  return affixe;
}
export function appliquerAffixesElite(monstres, rng, idsAffixes) {
  let affixeChoisi =
    (idsAffixes ?? [])
      .map((id) => AFFIXES_GROUPE.find((candidat) => candidat.id === id))
      .find((trouve) => trouve !== undefined) ??
    AFFIXES_GROUPE[Math.floor(rng() * AFFIXES_GROUPE.length)];
  appliquerAffixe(monstres, rng, affixeChoisi.id);
  return [affixeChoisi];
}
export function especesNormalesZone(zone) {
  let especes = new Set();
  for (let combatId of zone.pools.normales) {
    for (let ennemi of COMBATS[combatId]?.ennemis ?? []) {
      especes.add(ennemi.monstre);
    }
  }
  return [...especes];
}
export function appliquerDifficulteMonstres(monstres, effets, options) {
  let normal = options.type === `combat` || options.type === `combat_dur`;
  if (effets.renfortAvant && normal && options.especesZone?.length) {
    let occupees = new Set(monstres.map((monstre) => monstre.position));
    let positionLibre = [0, 1, 2, 3].find((position) => !occupees.has(position));
    if (positionLibre !== undefined) {
      let espece = options.especesZone[Math.floor(options.rng() * options.especesZone.length)];
      monstres.push(creerMonstre(MONSTRES[espece], `asc_${espece}`, positionLibre));
    }
  }
  if (effets.pvMult) {
    for (let monstre of monstres) {
      multiplierPv(monstre, effets.pvMult);
    }
  }
}
// Puissance des monstres d'une zone (src/data/ajustementsZones.json, réglée par simulation) : PV et
// dégâts multipliés par le même facteur.
function facteurTypeZone(type, zoneId) {
  const trouve = trouverZoneDansMonde(zoneId);
  let facteur = facteurType(type, trouve?.index ?? 0, trouve?.tranche.zones.length ?? 12);
  if (type === `donjon`) {
    facteur *= AJUSTEMENTS_DONJONS[zoneId] ?? 1;
  }
  return facteur;
}
export const puissanceZone = (zoneId) => AJUSTEMENTS_ZONES[zoneId] ?? 1;
export function appliquerPuissanceZone(monstres, zoneId, type) {
  // facteur de la zone × facteur du type de combat (normal / difficile / donjon)
  let facteur = puissanceZone(zoneId) * facteurTypeZone(type, zoneId);
  if (facteur === 1) {
    return;
  }
  for (let monstre of monstres) {
    multiplierPv(monstre, facteur);
    for (let st of [`force`, `intelligence`, `agilite`, `chance`]) {
      if (monstre.stats[st] !== undefined) {
        // dégâts ∝ (1 + 0,03 × stat) : on multiplie ce terme par f
        monstre.stats[st] = Math.max(
          0,
          Math.round(((1 + 0.03 * monstre.stats[st]) * facteur - 1) / 0.03),
        );
      }
    }
  }
}
export function effetsDifficulte(ascension) {
  return DIFFICULTES[Math.max(0, Math.min(Math.trunc(ascension) || 0, DIFFICULTES.length - 1))]
    .effets;
}
export function chanceArchi(run) {
  return (
    CONFIG_ARCHI.chance +
    CONFIG_ARCHI.philtre * Math.min(run.philtres ?? 0, CONFIG_ARCHI.philtresMax)
  );
}
// Bonus de la jauge de traque après `n` combats sans archimonstre inédit.
export const bonusJaugeArchi = (combatsSansNouveau) =>
  Math.min(
    CONFIG_ARCHI.bonusSansNouveauMax,
    CONFIG_ARCHI.bonusParCombatSansNouveau * (combatsSansNouveau ?? 0),
  );
// Chance qu'un archimonstre encore jamais capturé apparaisse : bien plus haute, et grandit à chaque
// combat sans nouvel archi (jauge de traque, gardée d'une run à l'autre).
export function chanceArchiNouveau(run, combatsSansNouveau = 0) {
  return Math.min(
    0.6,
    chanceArchi(run) * CONFIG_ARCHI.multNouveau + bonusJaugeArchi(combatsSansNouveau),
  );
}
function transformerEnArchi(monstre) {
  if (monstre.archi || !monstre.archiNom) {
    return;
  }
  monstre.archi = true;
  monstre.nom = monstre.archiNom;
  multiplierPv(monstre, CONFIG_ARCHI.pvMult);
  let base = monstre.stats;
  monstre.stats = {
    force: Math.round(base.force * CONFIG_ARCHI.statMult),
    intelligence: Math.round(base.intelligence * CONFIG_ARCHI.statMult),
    agilite: Math.round(base.agilite * CONFIG_ARCHI.statMult),
    vitalite: Math.round(base.vitalite * CONFIG_ARCHI.statMult),
    chance: Math.round((base.chance ?? 0) * CONFIG_ARCHI.statMult),
  };
}
/**
 * Transforme au hasard des monstres en archimonstres. `captures` (facultatif) : espèces déjà
 * capturées ; les autres utilisent `chanceNouveau`. Renvoie true si un archi encore jamais capturé
 * est apparu.
 */
export function tirerArchis(
  monstres,
  rng,
  chance = CONFIG_ARCHI.chance,
  captures,
  chanceNouveau = chance,
) {
  let nouveau = false;
  for (let monstre of monstres) {
    if (!monstre.archiNom) {
      continue;
    }
    const inedit = captures !== undefined && !captures.has(monstre.monstreId);
    if (rng() < (inedit ? chanceNouveau : chance)) {
      transformerEnArchi(monstre);
      nouveau ||= inedit;
    }
  }
  return nouveau;
}
export function tirerMonstreRare(monstres, rng, options) {
  if (options.type !== `combat`) {
    return;
  }
  let rare = MONSTRES_RARES[options.tranche];
  if (!rare?.especes.length || rng() >= rare.chance) {
    return;
  }
  let occupees = new Set(monstres.map((existant) => existant.position));
  let position = [0, 1, 2, 3, 4, 5, 6, 7].find((place) => !occupees.has(place));
  if (position === undefined) {
    return;
  }
  let espece = rare.especes[Math.floor(rng() * rare.especes.length)];
  let monstre = creerMonstre(MONSTRES[espece], `err_${espece}`, position);
  transformerEnArchi(monstre);
  monstres.push(monstre);
  return monstre.nom;
}
