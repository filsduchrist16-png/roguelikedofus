import { jouerCombat } from "./combat.js";
import {
  recupererApresVictoire,
  effetsDifficulte,
  herosVivants,
  tirerRecrues,
  recruter,
  chanceArchi,
} from "../jeu/run.js";
import { numeroZone, genererStockHdv } from "../jeu/economie.js";
import { idoleActive } from "../jeu/rencontres.js";
import { BONUS_DEFI } from "../jeu/defis.js";
import {
  distribuerKamas,
  gagnerXpEquipe,
  distribuerButin,
  preparerButin,
  soignerAvecGain,
} from "./recompenses.js";
import {
  calculerXpCombat,
  CONFIG_ARCHI,
  CONFIG_CARTE,
  XP_PAR_COMBAT,
  getMonde,
} from "../jeu/config.js";
import { texteBilan } from "../ui/finCombat.js";
import { secretDuMonde, CHANCES_CLE } from "../jeu/secret.js";
import { ecranMessage } from "../ui/ecrans/message.js";
import { traiterQuetes } from "./quetes.js";
import { verifierQuetesMeta } from "../jeu/quetes.js";
import { quetesMeta, ctxMeta, meta, choixAleatoireMath, etatRun } from "./etat.js";
import { sauverRun } from "../sauvegarde/run.js";
import { rngGraine } from "../jeu/runDuJour.js";
import { pctSoinTaverne } from "../sauvegarde/meta.js";
import { ecranTaverne } from "../ui/ecrans/taverne.js";
import { afficherBandeau } from "../ui/ecrans/succes.js";
import { CLASSES } from "../data/index.js";
import { ecranHdv } from "../ui/ecrans/hdv.js";
import { ecranForgemagie } from "../ui/ecrans/forgemagie.js";
import { jouerRencontre } from "./rencontres.js";
import { tirerTypeZaap } from "../carte/generation.js";
import { ecranRencontre } from "../ui/ecrans/rencontre.js";
import { ecranButin } from "../ui/ecrans/butin.js";
import { RELIQUES_RUN } from "../data/index.js";
import { butinDeZone } from "../jeu/config.js";
import { tirerObjet } from "../jeu/run.js";
import { enregistrerCollection } from "../sauvegarde/meta.js";
import {
  acheterReliqueRun,
  contenuCoffre,
  optionsCamp,
  peutCrocheterCoffre,
  piegePv,
  reliqueDeCoffre,
  reliqueTaverne,
  reposCamp,
} from "../jeu/cases.js";
import { noterAlmanax } from "./almanax.js";
import { detailRelique } from "./rencontres.js";
import {
  appliquerChoix,
  decrireChoix,
  multKamasEliteRun,
  multXpRun,
  soinFinCombat,
  soinTaverneRun,
  tirerOffreCombat,
} from "../jeu/recompensesRun.js";

export const ARTICLES_NOEUDS = {
  combat: `un combat`,
  combat_dur: `un combat dur`,
  taverne: `une taverne`,
  otomai: `un Otomaï`,
  zaap: `un zaap`,
  donjon: `le donjon`,
  hdv: `un Hôtel de vente`,
  forgemagie: `une Forgemagie`,
  rencontre: `une rencontre`,
  camp: `un camp de repos`,
  coffre: `un coffre`,
};
// Avancée dans le monde (0 à la première zone, 1 à la dernière) : les offres s'améliorent.
function progressionDansMonde(run, zoneId) {
  const zones = getMonde(run.trancheId).zones;
  const indice = zones.indexOf(zoneId);
  return indice < 0 || zones.length < 2 ? 0 : indice / (zones.length - 1);
}
// Camp de repos : se soigner OU améliorer gratuitement un sort (une des trois améliorations proposées).
async function jouerCamp(run, zone) {
  run.stats.camps = (run.stats.camps ?? 0) + 1;
  let { soinPct, ameliorations } = optionsCamp(
    run,
    Math.random,
    progressionDansMonde(run, zone?.id),
  );
  let mortDef = !!effetsDifficulte(run.ascension).mortDefinitive;
  let choix = await ecranRencontre({
    equipe: run.persos,
    titre: `⛺ Camp de repos`,
    texte: `Un feu crépite à l'abri des rochers. Le temps d'une halte : te reposer, ou t'entraîner pour de bon.`,
    choix: [
      {
        id: `repos`,
        libelle: `💤 Se reposer`,
        detail: `Chaque héros${mortDef ? ` debout` : `, K.O. compris,`} récupère ${Math.round(soinPct * 100)} % de ses PV max.`,
      },
      ...ameliorations.map((amelioration, indice) => {
        let description = decrireChoix(amelioration, run);
        return {
          id: `a${indice}`,
          libelle: `${description.icone} Méditer : ${description.titre}`,
          detail: `${description.sousTitre}. ${description.effet}`,
        };
      }),
    ],
  });
  if (choix === `repos`) {
    afficherBandeau(`⛺ Repos : +${reposCamp(run, soinPct)} PV pour l'équipe`);
    return;
  }
  let texte = appliquerChoix(run, ameliorations[Number(choix.slice(1))]);
  if (texte) {
    afficherBandeau(`⛺ ${texte}`);
  }
}
// Coffre : relique de run ou objet de la zone ; parfois piégé (combat avant le trésor, ou aiguilles).
async function jouerCoffre(run, zone, noeud) {
  let crocheteur = peutCrocheterCoffre(run);
  let choix = await ecranRencontre({
    equipe: run.persos,
    titre: `🧰 Coffre`,
    img: `/assets/monstres/coffre_forgerons.png`,
    texte: `Un coffre cerclé de fer t'attend. Il renferme une relique de run ou un objet… mais certains sont piégés.`,
    choix: [
      {
        id: `ouvrir`,
        libelle: crocheteur ? `Le crocheter` : `L'ouvrir`,
        detail: crocheteur
          ? `Ton crocheteur désamorce tout piège : le trésor est garanti.`
          : `Peut-être un piège : des monstres surgissent (combat, puis le trésor), ou des aiguilles (−${Math.round(CONFIG_CARTE.coffre.pertePv * 100)} % de PV max, coffre vide).`,
      },
      { id: `partir`, libelle: `Passer son chemin` },
    ],
  });
  if (choix === `partir`) {
    return `continue`;
  }
  run.stats.coffres = (run.stats.coffres ?? 0) + 1;
  noterAlmanax(meta, `coffre`);
  let { tresor, piege } = contenuCoffre(noeud, Math.random, { crocheteur });
  if (piege === `pv`) {
    let perte = piegePv(run);
    await ecranMessage(
      `💥 Piège !`,
      `Des aiguilles empoisonnées jaillissent du coffre, vide : l'équipe perd ${perte} PV.`,
    );
    return `continue`;
  }
  if (piege === `combat`) {
    await ecranMessage(`👹 Coffre gardé !`, `Des monstres surgissent pour défendre le coffre !`);
    let combatId = noeud?.combatId ?? choixAleatoireMath(zone?.pools?.normales ?? []) ?? null;
    if (combatId) {
      let issue = await resoudreNoeud(run, `combat`, combatId, XP_PAR_COMBAT.combat, zone);
      if (issue !== `continue`) {
        return issue;
      }
    }
  }
  let relique =
    tresor === `relique`
      ? reliqueDeCoffre(run, Math.random, progressionDansMonde(run, zone?.id))
      : null;
  if (relique) {
    appliquerChoix(run, relique);
    let def = RELIQUES_RUN[relique.id];
    await ecranMessage(
      `${def.icone} ${def.nom}`,
      `Le coffre renfermait une relique de run : ${detailRelique(relique.id, run)}`,
    );
    return `continue`;
  }
  // objet de la zone (ou relique épuisée) : au moins rare
  let butin = zone ? butinDeZone(zone.id) : null;
  let ids = [...(butin?.normales ?? []), ...(butin?.elites ?? [])];
  let id = ids.length ? ids[Math.floor(Math.random() * ids.length)] : null;
  let objet = id
    ? (tirerObjet(id, Math.random, [`rare`, `epique`]) ?? tirerObjet(id, Math.random))
    : null;
  if (objet) {
    run.inventaire.push(objet);
    enregistrerCollection(meta, [objet]);
    await ecranButin([objet], run, `🧰 Le coffre renfermait un objet !`);
  } else {
    let kamas = distribuerKamas(run, `combat_dur`, numZoneDe(zone));
    await ecranMessage(`💰 Trésor`, `Le coffre contenait ${kamas} kamas.`);
  }
  return `continue`;
}
const numZoneDe = (zone) => (zone?.id ? numeroZone(zone.id) : 1);
// Choix d'une case (camp, rencontre) : une graine est rangée dans la run, et la run sauvegardée,
// avant le tirage ; les options (tirées avant le premier écran) l'utilisent à la place de
// Math.random. Un rechargement sur cette case redonne la même graine, donc le même choix.
function jouerAvecGraine(run, noeud, type, jouer) {
  const zoneIdx = etatRun.active?.zoneIdx;
  const cle = `${zoneIdx ?? `-`}:${noeud?.id ?? `-`}:${type}`;
  if (run.graineCase?.cle !== cle) {
    run.graineCase = { cle, graine: Math.floor(Math.random() * 2 ** 32) };
  }
  if (Number.isInteger(zoneIdx)) {
    sauverRun(zoneIdx, run);
  }
  const hasard = Math.random;
  Math.random = rngGraine(run.graineCase.graine);
  try {
    // seule la partie synchrone (tirage des options, jusqu'au premier écran) suit la graine
    return jouer();
  } finally {
    Math.random = hasard;
  }
}
export async function resoudreNoeud(run, type, combatId, xpCombat, zone, eliteModifs, noeud) {
  let zoneId = zone?.id;
  switch (type) {
    case `combat`:
    case `combat_dur`: {
      let { gagne, defiOk, prime } = await jouerCombat(run, combatId, {
        elite: type === `combat_dur`,
        eliteModifs,
        type,
        zone,
      });
      if (!gagne) {
        return `wipe`;
      }
      recupererApresVictoire(run);
      soinFinCombat(run);
      let numZone = zoneId ? numeroZone(zoneId) : 1;
      let idole = idoleActive(run, zoneId);
      let bonusDefi = defiOk ? 1 + BONUS_DEFI : 1;
      let kamas = distribuerKamas(
        run,
        type,
        numZone,
        bonusDefi * (idole?.kamasMult ?? 1) * (prime ? 2 : 1) * multKamasEliteRun(run, type),
      );
      let { xp, niveaux } = gagnerXpEquipe(
        run,
        Math.round(
          calculerXpCombat(xpCombat, numZone, run.trancheId) *
            bonusDefi *
            (idole?.xpMult ?? 1) *
            multXpRun(run),
        ),
      );
      // choix de récompense, butin et clé : tout est tiré et rangé dans la run ici, sans écran.
      // jouerZone marque ensuite la case visitée, sauvegarde la run, puis montre butin et
      // récompense sur un seul écran (proposerOffreCombat) : un rechargement remontre cet écran
      // sans rejouer le combat ni relancer le tirage.
      const offre = tirerOffreCombat(run, {
        elite: type === `combat_dur`,
        numZone,
        progression: progressionDansMonde(run, zoneId),
        rng: Math.random,
      });
      const objets = preparerButin(run, zoneId, type, type === `combat_dur` ? `donjon` : undefined);
      let cle = false;
      if (
        type === `combat_dur` &&
        !run.cle &&
        secretDuMonde(run.trancheId) &&
        Math.random() < CHANCES_CLE.combatDur
      ) {
        run.cle = cle = true;
      }
      run.butinCombat = { objets, bilan: texteBilan({ xp, kamas, defiOk, niveaux }), cle };
      run.offreCombat = offre;
      return `continue`;
    }
    case `taverne`: {
      if (effetsDifficulte(run.ascension).tavernesCoupeesAPlein && herosVivants(run) >= 4) {
        await ecranMessage(
          `🍺 Taverne fermée`,
          `En difficulté Ultime, plus aucune taverne ne t'accueille une fois ton équipe au complet.`,
        );
        return `continue`;
      }
      run.stats.tavernes = (run.stats.tavernes ?? 0) + 1;
      let pctSoin = soinTaverneRun(run, pctSoinTaverne(run.ascension));
      let effets = effetsDifficulte(run.ascension);
      let recrues = tirerRecrues(run, Math.random);
      // une relique de run en vente au comptoir (achat en plus du soin ou de la recrue)
      let enVente = reliqueTaverne(run, Math.random, zoneId ? numeroZone(zoneId) : 1);
      let choix;
      while (true) {
        choix = await ecranTaverne(
          run.persos,
          recrues,
          pctSoin,
          !!effets.mortDefinitive,
          !!effets.tavernesCoupeesAPlein,
          enVente && {
            ...enVente,
            icone: RELIQUES_RUN[enVente.id].icone,
            nom: RELIQUES_RUN[enVente.id].nom,
            detail: detailRelique(enVente.id, run),
            kamas: run.kamas,
          },
        );
        if (choix.type !== `relique`) {
          break;
        }
        if (enVente && acheterReliqueRun(run, enVente.id, enVente.prix)) {
          afficherBandeau(
            `🍺 ${RELIQUES_RUN[enVente.id].icone} ${RELIQUES_RUN[enVente.id].nom} achetée (−${enVente.prix} kamas)`,
          );
          enVente = null;
        }
      }
      if (choix.type === `soin`) {
        let gain = soignerAvecGain(run, pctSoin);
        let resteKo = effets.mortDefinitive && run.persos.some((perso) => perso.pvActuels <= 0);
        afficherBandeau(
          gain
            ? `🍺 Équipe soignée : +${gain} PV`
            : resteKo
              ? `🍺 Les héros debout étaient déjà en pleine forme`
              : `🍺 L'équipe était déjà en pleine forme`,
        );
      } else {
        recruter(run, choix.classeId, choix.remplace);
        run.stats.recrutements = (run.stats.recrutements ?? 0) + 1;
        afficherBandeau(
          `🍺 Recrue ! ${CLASSES[choix.classeId].nom} rejoint l'équipe${choix.remplace ? ` à la place de ${CLASSES[choix.remplace]?.nom ?? choix.remplace}` : ``}`,
        );
      }
      return `continue`;
    }
    case `hdv`:
      await ecranHdv(run, genererStockHdv(zoneId ?? ``, Math.random), meta);
      await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
      return `continue`;
    case `forgemagie`:
      await ecranForgemagie(run, meta);
      await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
      return `continue`;
    case `otomai`:
      if ((run.philtres ?? 0) >= CONFIG_ARCHI.philtresMax) {
        afficherBandeau(
          `🧪 Otomaï : tes philtres sont déjà au maximum (${CONFIG_ARCHI.philtresMax}/${CONFIG_ARCHI.philtresMax})`,
        );
        return `continue`;
      }
      run.philtres = (run.philtres ?? 0) + 1;
      afficherBandeau(
        `🧪 Otomaï : philtre ${run.philtres}/${CONFIG_ARCHI.philtresMax}, archimonstres à ${Math.round(chanceArchi(run) * 1000) / 10} %`,
      );
      return `continue`;
    case `donjon`: {
      let { gagne, defiOk } = await jouerCombat(run, combatId, {
        type: `donjon`,
        zone,
      });
      if (!gagne) {
        return `wipe`;
      }
      // l'idole de la zone s'applique aussi au donjon, comme aux combats normaux
      let idoleDonjon = idoleActive(run, zoneId);
      let bonusDefi = defiOk ? 1 + BONUS_DEFI : 1;
      let kamas = distribuerKamas(
        run,
        `donjon`,
        zoneId ? numeroZone(zoneId) : 1,
        idoleDonjon?.kamasMult ?? 1,
      );
      if (defiOk) {
        kamas += distribuerKamas(
          run,
          `combat_dur`,
          zoneId ? numeroZone(zoneId) : 1,
          idoleDonjon?.kamasMult ?? 1,
        );
      }
      soinFinCombat(run);
      let { xp, niveaux } = gagnerXpEquipe(
        run,
        Math.round(
          calculerXpCombat(XP_PAR_COMBAT.donjon, zoneId ? numeroZone(zoneId) : 1, run.trancheId) *
            bonusDefi *
            (idoleDonjon?.xpMult ?? 1) *
            multXpRun(run),
        ),
      );
      await distribuerButin(
        run,
        zoneId,
        type,
        undefined,
        texteBilan({ xp, kamas, defiOk, niveaux, libelleDefi: `défi réussi` }),
      );
      await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
      return `victoire`;
    }
    case `camp`:
      await jouerAvecGraine(run, noeud, type, () => jouerCamp(run, zone));
      run.graineCase = null;
      noterAlmanax(meta, `camp`);
      return `continue`;
    case `coffre`:
      return jouerCoffre(run, zone, noeud);
    case `rencontre`:
      await jouerAvecGraine(run, noeud, type, () => jouerRencontre(run, zone));
      run.graineCase = null;
      await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
      return `continue`;
    default:
      return `continue`;
  }
}
export async function resoudreZaap(pools, exclus) {
  let type = tirerTypeZaap(Math.random, exclus);
  afficherBandeau(`🌀 Le zaap mène à : ${ARTICLES_NOEUDS[type]}`);
  if (type === `combat`) {
    return {
      type,
      combatId: choixAleatoireMath(pools.normales),
      xp: XP_PAR_COMBAT.combat,
    };
  }
  if (type === `combat_dur`) {
    return {
      type,
      combatId: choixAleatoireMath(pools.elite),
      xp: XP_PAR_COMBAT.combat_dur,
    };
  }
  return {
    type,
    xp: 0,
  };
}
