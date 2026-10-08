import { CLASSES, COMBATS, DOFUS, EQUIPEMENTS, MONSTRES, SORTS } from "./data/index.js";
import {
  XP_PAR_COMBAT,
  butinDeZone,
  calculerXpCombat,
  getMonde,
  zonesDuMonde,
} from "./jeu/config.js";
import { executerCombat } from "./combat/moteur.js";
import { choisirActionIA } from "./combat/ia.js";
import { genererCarte, tirerTypeZaap } from "./carte/generation.js";
import {
  contexteMeta,
  nouvelEtatQuetes,
  trouverQuete,
  verifierQuetesCombat,
  verifierQuetesMeta,
  verifierQuetesRun,
  verifierQuetesZone,
} from "./jeu/quetes.js";
import {
  appliquerAffixesElite,
  appliquerPuissanceZone,
  appliquerDifficulteMonstres,
  chanceArchi,
  combattantsEquipe,
  effetsDifficulte,
  especesNormalesZone,
  gagnerXpPerso,
  monstresDuCombat,
  multiplicateurKamas,
  noeudsExclus,
  nouvelleRun,
  pvMaxPerso,
  recruter,
  recupererApresVictoire,
  soignerEquipe,
  synchroniserPv,
  tirerArchis,
  chanceArchiNouveau,
  tirerButin,
  tirerMonstreRare,
  tirerObjet,
  tirerRecrues,
} from "./jeu/run.js";
import { EMPLACEMENTS } from "./jeu/emplacements.js";
import { chargerRun, effacerRun, sauverRun } from "./sauvegarde/run.js";
import {
  CHANCES_CLE,
  monstresSecrets,
  nomCle,
  recompensesSecret,
  secretDuMonde,
  tirerRareteSecret,
} from "./jeu/secret.js";
import { ajouterKamas, gainKamas, genererStockHdv, numeroZone } from "./jeu/economie.js";
import {
  ajouterDofus,
  appliquerBonusDofus,
  bonusDofus,
  capturerArchi,
  chanceRelique,
  chargerMeta,
  dofusAGagner,
  dofusDebloquables,
  dofusPossedes,
  enregistrerAscension,
  enregistrerCollection,
  enregistrerRun,
  enregistrerToileMax,
  pctSoinTaverne,
  prospectionMoyenne,
  reinitialiserDofus,
  rendreDofusSuspendus,
  sauverMeta,
  tirerReliques,
} from "./sauvegarde/meta.js";
import { nouveauSuiviCombat, resumeCombat, suivreEvenement } from "./jeu/suiviCombat.js";
import {
  definirRacine,
  fondDuMonde,
  installerInfobulleAide,
  installerInfobulleDofus,
  installerToucheEchap,
  parametres,
} from "./ui/commun.js";
import {
  controleurJoueur,
  definirDefiCombat,
  majEtatDefi,
  enregistrerFx,
  initialiserVueCombat,
  installerInfobulleSorts,
  installerRaccourcisCombat,
  journaliser,
  rafraichirCombat,
} from "./ui/combat.js";
import { ecranButin } from "./ui/ecrans/butin.js";
import {
  afficherObjectifsCombat,
  majObjectifsCombat,
  retirerObjectifsCombat,
} from "./ui/objectifs.js";
import { objectifsDuCombat } from "./jeu/objectifs.js";
import { BONUS_DEFI, defiReussi, etatDefi, tirerDefi } from "./jeu/defis.js";
import {
  BENEDICTIONS,
  IDOLES,
  bonusEquipeRun,
  dieuxProposes,
  effetsEnCours,
  gainBase,
  idoleActive,
  idolesProposees,
  peutCrocheter,
  prixMarchand,
  tirerRencontre,
  traqueActive,
  zoneAArchis,
} from "./jeu/rencontres.js";
import { ecranRencontre } from "./ui/ecrans/rencontre.js";
import { ecranCaptureArchi, ecranReliques } from "./ui/ecrans/recompenses.js";
import {
  afficherBandeau,
  afficherBandeauQuete,
  ecranDofusDebloque,
  ecranSuccesObtenu,
} from "./ui/ecrans/succes.js";
import { ecranAccueil } from "./ui/ecrans/accueil.js";
import { ecranChoixEquipe } from "./ui/ecrans/choixEquipe.js";
import { ecranTaverne } from "./ui/ecrans/taverne.js";
import { ecranMessage, ecranZaap } from "./ui/ecrans/message.js";
import { ecranCarte } from "./ui/ecrans/carte.js";
import { ecranRecap } from "./ui/ecrans/recap.js";
import { ecranHdv } from "./ui/ecrans/hdv.js";
import { ecranForgemagie } from "./ui/ecrans/forgemagie.js";
import "./style.css";
import "./interface.css";
import "./visuel.css";
function initialiserInterface(elementApp) {
  definirRacine(elementApp);
  fondDuMonde(null);
  installerInfobulleDofus();
  installerInfobulleSorts();
  installerInfobulleAide();
  installerRaccourcisCombat();
  installerToucheEchap();
}
const attendre = (e) => new Promise((resolve) => setTimeout(resolve, e));
const choixAleatoireMath = (e) => e[Math.floor(Math.random() * e.length)];
const elementApp = document.getElementById(`app`);
if (!elementApp) {
  throw Error(`#app introuvable`);
}
initialiserInterface(elementApp);
const meta = chargerMeta();
const quetesMeta = () => (meta.quetes ??= nouvelEtatQuetes());
const ctxMeta = () => contexteMeta(meta);
async function traiterQuetes(e, t) {
  sauverMeta(meta);
  if (!t.quetes.length) {
    await donnerDofusEnAttente(e);
    return;
  }
  for (let n of t.quetes) {
    afficherBandeauQuete(n.nom);
    if (e) {
      (e.stats.quetes ??= []).push(n.id);
    }
  }
  let n = false;
  for (let e of t.succes) {
    let t = dofusAGagner(meta, e.def);
    let r = t !== undefined;
    if (r) {
      ajouterDofus(meta, t);
      n = true;
    }
    await ecranSuccesObtenu(e.def, r, meta);
  }
  sauverMeta(meta);
  if (n) {
    await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
  } else {
    await donnerDofusEnAttente(e);
  }
}
// Dofus dont le succès est terminé mais pas encore remis (anciennes sauvegardes), en cascade.
async function donnerDofusEnAttente(e) {
  let ids = dofusDebloquables(meta);
  if (!ids.length) {
    return;
  }
  for (let id of ids) {
    ajouterDofus(meta, id);
    await ecranDofusDebloque(id);
  }
  sauverMeta(meta);
  await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
}
function contexteRun(e, trancheId, victoire) {
  return {
    trancheId,
    victoire,
    ascension: e.ascension,
    tavernes: e.stats.tavernes ?? 0,
    recrutements: e.stats.recrutements ?? 0,
    tailleEquipe: e.persos.length,
    classes: e.persos.map((e) => e.classeId),
    quatreHerosEquipes:
      e.persos.length === 4 && e.persos.every((e) => EMPLACEMENTS.every((t) => e.equipement[t])),
  };
}
const quetesDeLaRun = (e) =>
  (e.stats.quetes ?? []).map((e) => trouverQuete(e)).filter((e) => e !== undefined);
const controleurEnnemi = async (e, t) => {
  await attendre(parametres.combatRapide ? 180 : 550);
  return choisirActionIA(e, t);
};
async function jouerCombat(e, combatId, n) {
  let r = COMBATS[combatId]?.nom ?? `Combat`;
  let i = combattantsEquipe(e);
  let a = n.type === `secret` ? monstresSecrets(e.trancheId, n.zone) : monstresDuCombat(combatId);
  appliquerDifficulteMonstres(a, effetsDifficulte(e.ascension), {
    type: n.type,
    especesZone: n.zone ? especesNormalesZone(n.zone) : undefined,
    rng: Math.random,
  });
  // après le renfort d'ascension, pour qu'il soit aussi à la puissance de la zone
  appliquerPuissanceZone(a, n.zone?.id);
  if (n.elite) {
    let e = appliquerAffixesElite(a, Math.random, n.eliteModifs);
    r = `${r} · ${e.map((e) => `${e.nom} (${e.desc})`).join(` · `)}`;
  }
  // idole de la zone et avis de recherche (rencontres)
  let idole = idoleActive(e, n.zone?.id);
  let traque = n.type === `donjon` || n.type === `secret` ? null : traqueActive(e, n.zone?.id);
  // la traque ne se déclenche que sur un combat qui peut contenir un archimonstre (ou pour la prime)
  if (traque?.archi && !a.some((m) => m.archiNom)) {
    traque = null;
  }
  let pvMult = (idole?.pvMult ?? 1) * (traque ? 1.2 : 1);
  if (pvMult !== 1) {
    for (let m of a) {
      m.pvBase = m.pvMax = m.pvActuels = Math.round(m.pvMax * pvMult);
    }
  }
  const captures = new Set(meta.archis);
  let nouvelArchi = tirerArchis(
    a,
    Math.random,
    chanceArchi(e),
    captures,
    chanceArchiNouveau(e, meta.jaugeArchi),
  );
  let prime = false;
  if (traque) {
    // la traque vise d'abord une espèce encore jamais capturée
    let libres = a.filter((m) => m.archiNom && !m.archi);
    let candidats = libres.filter((m) => !captures.has(m.monstreId));
    if (!candidats.length) {
      candidats = libres;
    }
    if (!traque.archi) {
      prime = true;
      e.traque = null;
    } else if (a.some((m) => m.archi) || candidats.length) {
      if (!a.some((m) => m.archi)) {
        const cible = candidats[Math.floor(Math.random() * candidats.length)];
        tirerArchis([cible], () => 0, 1);
        nouvelArchi ||= !captures.has(cible.monstreId);
      }
      r = `${r} · 📜 Traque`;
      e.traque = null;
    }
  }
  // jauge de traque : seuls les combats qui pouvaient contenir un archi inédit la font monter
  if (nouvelArchi) {
    meta.jaugeArchi = 0;
  } else if (a.some((m) => m.archiNom && !captures.has(m.monstreId))) {
    meta.jaugeArchi = (meta.jaugeArchi ?? 0) + 1;
  }
  let o = tirerMonstreRare(a, Math.random, {
    type: n.type,
    tranche: e.trancheId,
  });
  if (o) {
    r = `${r} · ⭐ ${o}`;
  }
  let s = bonusEquipeRun(meta, e);
  appliquerBonusDofus(i, s);
  let c = [...i, ...a];
  initialiserVueCombat(c, r, meta, {
    playerDamageBonus: s.damageMult,
    enemyDamageBonus: (effetsDifficulte(e.ascension).degatsMult ?? 1) * (idole?.degatsMult ?? 1),
    reliquesActives: dofusPossedes(meta),
  });
  afficherObjectifsCombat(
    objectifsDuCombat({
      quetes: quetesMeta(),
      combattants: c,
      combatId,
      noeud: n.type,
      zoneId: n.zone?.id,
      classes: e.persos.map((e) => e.classeId),
      elements: [...new Set(e.persos.flatMap((p) => CLASSES[p.classeId]?.elements ?? []))],
      soigneurs: i.some((h) => h.sorts.some((id) => SORTS[id]?.type === `soin`)),
      ascension: e.ascension,
      archis: meta.archis,
      reliques: meta.reliques ?? [],
      chanceRelique: chanceRelique(e.ascension, prospectionMoyenne(e, s.prospection)),
      dernierDonjon: n.type === `donjon` && getMonde(e.trancheId).zones.at(-1) === n.zone?.id,
      runSiVictoire: contexteRun(e, e.trancheId, true),
    }),
    { replierApres: parametres.combatRapide ? 5000 : 9000 },
  );
  let defi = tirerDefi(
    Math.random,
    a.map((m) => ({ ref: m.ref, nom: m.nom, boss: !!MONSTRES[m.monstreId]?.boss })),
    i,
  );
  definirDefiCombat(defi);
  let l = nouveauSuiviCombat();
  let herosVivantsAuDepart = i.filter((e) => e.pvActuels > 0).map((e) => e.ref);
  let gagne = await executerCombat(c, {
    onEvenement: (ev) => {
      suivreEvenement(l, ev, c);
      majEtatDefi(etatDefi(defi, l, c));
      majObjectifsCombat(l, c);
    },
    controllers: {
      // les créatures et tourelles invoquées par les héros jouent seules
      joueur: (c, cs) => (c.creature ? controleurEnnemi(c, cs) : controleurJoueur(c, cs)),
      ennemi: controleurEnnemi,
    },
    log: journaliser,
    fx: enregistrerFx,
    onDegats: (t, n) => {
      if (t.startsWith(`j_`)) {
        let r = t.slice(2);
        e.stats.degats[r] = (e.stats.degats[r] ?? 0) + n;
      }
    },
    onUpdate: async () => {
      rafraichirCombat();
      await attendre(parametres.combatRapide ? 20 : 60);
    },
    playerDamageBonus: s.damageMult,
    enemyDamageBonus: (effetsDifficulte(e.ascension).degatsMult ?? 1) * (idole?.degatsMult ?? 1),
    reliquesActives: dofusPossedes(meta),
  });
  retirerObjectifsCombat();
  synchroniserPv(e, c);
  if (
    gagne &&
    ((e.stats.combats += 1), (e.stats.archis += await capturerArchis(c)), n.type === `donjon`)
  ) {
    let t = tirerReliques(
      meta,
      c
        .filter(
          (e) =>
            e.camp === `ennemi` && e.monstreId && MONSTRES[e.monstreId]?.boss && e.pvActuels <= 0,
        )
        .map((e) => e.monstreId),
      e.ascension,
      prospectionMoyenne(e, s.prospection + (idole?.prospection ?? 0)),
      Math.random,
    );
    if (t.length) {
      sauverMeta(meta);
      e.stats.reliques.push(...t);
      await ecranReliques(t);
    }
  }
  let resume = resumeCombat(l, {
    combattants: c,
    herosVivantsAuDepart,
    gagne,
    combatId,
    noeud: n.type,
    zoneId: n.zone?.id,
    classes: e.persos.map((e) => e.classeId),
    ascension: e.ascension,
  });
  let defiOk = defiReussi(defi, {
    ...resume,
    ordreMorts: [...l.morts].filter((ref) => a.some((m) => m.ref === ref)),
  });
  if (gagne) {
    e.stats.defis = (e.stats.defis ?? 0) + (defiOk ? 1 : 0);
    afficherBandeau(
      defiOk
        ? `🎯 Défi ${defi.nom} réussi : +${Math.round(BONUS_DEFI * 100)} % d'XP et de kamas`
        : `Défi ${defi.nom} raté`,
    );
  }
  await traiterQuetes(e, verifierQuetesCombat(quetesMeta(), resume));
  await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
  return {
    gagne,
    combatants: c,
    defiOk,
    prime,
  };
}
function gagnerXpEquipe(e, t) {
  for (let n of e.persos) {
    if (gagnerXpPerso(n, t, e.trancheId) > 0) {
      n.flashNiveau = true;
    }
  }
}
async function capturerArchis(e) {
  let t = [];
  for (let n of e) {
    if (n.camp === `ennemi` && n.archi && n.monstreId && capturerArchi(meta, n.monstreId)) {
      t.push(MONSTRES[n.monstreId]?.nom ?? n.monstreId);
    }
  }
  if (t.length) {
    await ecranCaptureArchi(t);
  }
  return t.length;
}
async function distribuerButin(e, t, n, r) {
  if (!t) {
    return;
  }
  let prospection = bonusEquipeRun(meta, e).prospection + (idoleActive(e, t)?.prospection ?? 0);
  let a = tirerButin(e, t, n, Math.random, r, prospection);
  enregistrerCollection(meta, a);
  e.stats.objets += a.length;
  if (a.length) {
    await ecranButin(a, e);
  }
}
function distribuerKamas(e, t, n, mult = 1) {
  ajouterKamas(
    e,
    Math.round(
      gainKamas(t, n, Math.random) *
        multiplicateurKamas(e) *
        bonusEquipeRun(meta, e).multKamas *
        mult,
    ),
  );
}
const ARTICLES_NOEUDS = {
  combat: `un combat`,
  combat_dur: `un combat dur`,
  taverne: `une taverne`,
  otomai: `un Otomai`,
  zaap: `un zaap`,
  donjon: `le donjon`,
  hdv: `un Hôtel de vente`,
  forgemagie: `un Forgemage`,
  rencontre: `une rencontre`,
};
async function resoudreNoeud(e, type, n, r, zone, eliteModifs) {
  let o = zone?.id;
  switch (type) {
    case `combat`:
    case `combat_dur`: {
      let { gagne, defiOk, prime } = await jouerCombat(e, n, {
        elite: type === `combat_dur`,
        eliteModifs,
        type,
        zone,
      });
      if (!gagne) {
        return `wipe`;
      }
      recupererApresVictoire(e);
      let c = o ? numeroZone(o) : 1;
      let idole = idoleActive(e, o);
      let bonusDefi = defiOk ? 1 + BONUS_DEFI : 1;
      distribuerKamas(e, type, c, bonusDefi * (idole?.kamasMult ?? 1) * (prime ? 2 : 1));
      gagnerXpEquipe(
        e,
        Math.round(calculerXpCombat(r, c, e.trancheId) * bonusDefi * (idole?.xpMult ?? 1)),
      );
      await distribuerButin(e, o, type, type === `combat_dur` ? `donjon` : undefined);
      if (
        type === `combat_dur` &&
        !e.cle &&
        secretDuMonde(e.trancheId) &&
        Math.random() < CHANCES_CLE.combatDur
      ) {
        e.cle = true;
        await ecranMessage(
          `🗝️ ${nomCle(e.trancheId)}`,
          `Un des monstres portait une clé : elle ouvre le donjon secret du monde, ${secretDuMonde(e.trancheId).nom}.`,
        );
      }
      await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
      return `continue`;
    }
    case `taverne`: {
      if (effetsDifficulte(e.ascension).tavernesCoupeesAPlein && e.persos.length >= 4) {
        await ecranMessage(
          `🍺 Taverne fermée`,
          `En difficulté Ultime, plus aucune taverne ne t'accueille une fois ton équipe au complet.`,
        );
        return `continue`;
      }
      e.stats.tavernes = (e.stats.tavernes ?? 0) + 1;
      let t = pctSoinTaverne(e.ascension);
      let n = effetsDifficulte(e.ascension);
      let r = tirerRecrues(e, Math.random);
      let i = await ecranTaverne(e.persos, r, t, !!n.mortDefinitive, !!n.tavernesCoupeesAPlein);
      if (i.type === `soin`) {
        soignerEquipe(e, t);
        await ecranMessage(
          `🍺 Taverne`,
          `L'équipe récupère ${Math.round(t * 100)} % de ses PV max.`,
        );
      } else {
        recruter(e, i.classeId, i.remplace);
        e.stats.recrutements = (e.stats.recrutements ?? 0) + 1;
        await ecranMessage(`🍺 Recrue !`, `${CLASSES[i.classeId].nom} rejoint l'équipe.`);
      }
      return `continue`;
    }
    case `hdv`:
      await ecranHdv(e, genererStockHdv(o ?? ``, Math.random), meta);
      await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
      return `continue`;
    case `forgemagie`:
      await ecranForgemagie(e, meta);
      await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
      return `continue`;
    case `otomai`:
      e.philtres += 1;
      await ecranMessage(
        `🧪 Otomai`,
        `L'alchimiste te prépare un philtre d'archimonstre : les archis apparaissent plus souvent pour le reste de la run (${Math.round(chanceArchi(e) * 1000) / 10} %).`,
      );
      return `continue`;
    case `donjon`: {
      let { gagne, defiOk } = await jouerCombat(e, n, {
        type: `donjon`,
        zone,
      });
      if (gagne && defiOk) {
        distribuerKamas(e, `combat_dur`, o ? numeroZone(o) : 1);
      }
      if (gagne) {
        return (
          await distribuerButin(e, o, type),
          await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta())),
          `victoire`
        );
      }
      return `wipe`;
    }
    case `rencontre`:
      await jouerRencontre(e, zone);
      await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
      return `continue`;
    default:
      return `continue`;
  }
}
// ---------- Rencontres (case « Rencontre » de la carte) ----------
async function jouerRencontre(e, zone) {
  let toile = zone ? numeroZone(zone.id) : 1;
  let type = tirerRencontre(Math.random, e.cle || !secretDuMonde(e.trancheId) ? [`cle`] : []);
  if (
    (type === `idoles` && idoleActive(e, zone?.id)) ||
    (type === `traque` && traqueActive(e, zone?.id))
  ) {
    type = `coffre`;
  }
  e.stats.rencontres = (e.stats.rencontres ?? 0) + 1;
  if (type === `sanctuaire`) {
    let dieux = dieuxProposes(e, Math.random);
    let choix = await ecranRencontre({
      titre: `⛩️ Sanctuaire des Douze`,
      texte: `Un autel dédié aux dieux du Krosmoz se dresse au bord du chemin. Une seule prière sera exaucée.`,
      choix: [
        ...dieux.map((id) => ({
          id,
          img: `/assets/class_symbol/${id}.png`,
          libelle: `Prier ${BENEDICTIONS[id].dieu} : ${BENEDICTIONS[id].nom}`,
          detail: `${BENEDICTIONS[id].desc}, pour toute la run.`,
        })),
        { id: `soin`, libelle: `Se recueillir`, detail: `L'équipe récupère 30 % de ses PV max.` },
      ],
    });
    if (choix === `soin`) {
      soignerEquipe(e, 0.3);
      await ecranMessage(`⛩️ Recueillement`, `L'équipe récupère 30 % de ses PV max.`);
    } else {
      (e.benedictions ??= []).push(choix);
      let b = BENEDICTIONS[choix];
      await ecranMessage(
        `✨ ${b.nom}`,
        `${b.dieu} exauce ta prière : ${b.desc} jusqu'à la fin de la run.`,
      );
    }
    return;
  }
  if (type === `coffre`) {
    let crochet = peutCrocheter(e);
    let choix = await ecranRencontre({
      titre: `🧰 Coffre abandonné`,
      img: `/assets/monstres/coffre_forgerons.png`,
      texte: `Un vieux coffre traîne au milieu du chemin. Trésor… ou piège ?`,
      choix: [
        {
          id: `ouvrir`,
          libelle: `L'ouvrir`,
          detail: `2 chances sur 3 : kamas, et peut-être un objet. Sinon, un piège blesse l'équipe (−20 % de PV max).`,
        },
        {
          id: `crocheter`,
          libelle: `Le crocheter prudemment`,
          detail: `Pas de piège : le trésor est garanti.`,
          desactive: crochet ? `` : `Il faut un Sram, un Roublard ou un Ecaflip dans l'équipe.`,
        },
        { id: `partir`, libelle: `Passer son chemin` },
      ],
    });
    if (choix === `partir`) {
      return;
    }
    if (choix === `ouvrir` && Math.random() < 1 / 3) {
      for (let p of e.persos) {
        if (p.pvActuels > 0) {
          p.pvActuels = Math.max(1, Math.round(p.pvActuels - pvMaxPerso(p) * 0.2));
        }
      }
      await ecranMessage(
        `💥 Piège !`,
        `Le coffre était piégé : chaque héros perd 20 % de ses PV max.`,
      );
      return;
    }
    let kamas = Math.round(gainBase(toile) * 1.5);
    ajouterKamas(e, kamas);
    let texte = `Le coffre contenait ${kamas} kamas.`;
    let butin = zone ? butinDeZone(zone.id) : null;
    if (!e.cle && secretDuMonde(e.trancheId) && Math.random() < CHANCES_CLE.coffre) {
      e.cle = true;
      texte += ` Au fond, une clé : la ${nomCle(e.trancheId)} ! Elle ouvre le donjon secret du monde.`;
    } else if (butin?.normales.length && Math.random() < 0.45) {
      let obj = tirerObjet(
        butin.normales[Math.floor(Math.random() * butin.normales.length)],
        Math.random,
      );
      if (obj) {
        e.inventaire.push(obj);
        enregistrerCollection(meta, [obj]);
        texte += ` Et un objet : ${EQUIPEMENTS[obj.id]?.nom ?? obj.id} !`;
      }
    }
    await ecranMessage(`💰 Trésor`, texte);
    return;
  }
  if (type === `marchand`) {
    let prix = prixMarchand(toile);
    let achete = new Set();
    let xp = calculerXpCombat(XP_PAR_COMBAT.combat_dur, toile, e.trancheId);
    while (true) {
      let offre = (id, libelle, detail) => ({
        id,
        libelle,
        detail,
        prix: prix[id],
        desactive: achete.has(id)
          ? `Déjà acheté.`
          : e.kamas < prix[id]
            ? `Pas assez de kamas.`
            : ``,
      });
      let choix = await ecranRencontre({
        titre: `🧳 Marchand ambulant`,
        img: `/assets/divers/potion_de_soin.png`,
        texte: `Kerubim Crépin, l'antiquaire de Bonta, est en vadrouille et déballe quelques trouvailles.`,
        kamas: e.kamas,
        choix: [
          offre(`potion`, `Potion de Soin`, `L'équipe récupère 40 % de ses PV max.`),
          offre(`parchemin`, `Parchemin d'expérience`, `${xp} XP pour chaque héros.`),
          offre(
            `philtre`,
            `Philtre d'Otomaï`,
            `Les archimonstres apparaissent plus souvent pour le reste de la run.`,
          ),
          { id: `partir`, libelle: `Repartir` },
        ],
      });
      if (choix === `partir`) {
        return;
      }
      e.kamas -= prix[choix];
      achete.add(choix);
      if (choix === `potion`) {
        soignerEquipe(e, 0.4);
      } else if (choix === `parchemin`) {
        gagnerXpEquipe(e, xp);
      } else {
        e.philtres += 1;
      }
    }
  }
  if (type === `cle`) {
    let prix = prixMarchand(toile).cle;
    let secret = secretDuMonde(e.trancheId);
    let choix = await ecranRencontre({
      titre: `🗝️ ${nomCle(e.trancheId)}`,
      img: `/assets/divers/cle_donjon.png`,
      texte: `Un contrebandier encapuchonné fait tinter une vieille clé : « Elle ouvre le ${secret.nom}. Pour qui ose y entrer… »`,
      kamas: e.kamas,
      choix: [
        {
          id: `acheter`,
          libelle: `Acheter la clé`,
          prix,
          detail: `Après le boss d'une zone, tu pourras entrer dans le donjon secret (objet épique ou légendaire garanti).`,
          desactive: e.kamas < prix ? `Pas assez de kamas.` : ``,
        },
        {
          id: `des`,
          libelle: `La jouer aux dés`,
          detail: `Une chance sur deux : la clé gratuite. Sinon, tu perds ${Math.round(prix / 2)} kamas (ou ce qu'il te reste).`,
        },
        { id: `partir`, libelle: `Passer son chemin` },
      ],
    });
    if (choix === `acheter`) {
      e.kamas -= prix;
      e.cle = true;
      await ecranMessage(`🗝️ Clé obtenue`, `La ${nomCle(e.trancheId)} est à toi.`);
    } else if (choix === `des`) {
      if (Math.random() < 0.5) {
        e.cle = true;
        await ecranMessage(
          `🎲 Gagné !`,
          `Le contrebandier grommelle et te tend la ${nomCle(e.trancheId)}.`,
        );
      } else {
        let perte = Math.min(e.kamas, Math.round(prix / 2));
        e.kamas -= perte;
        await ecranMessage(
          `🎲 Perdu…`,
          `Le contrebandier empoche ${perte} kamas et disparaît dans la foule.`,
        );
      }
    }
    return;
  }
  if (type === `idoles`) {
    let ids = idolesProposees(Math.random);
    let choix = await ecranRencontre({
      titre: `🗿 Autel des Idoles`,
      texte: `Des idoles anciennes promettent gloire et richesses à qui ose les porter… jusqu'à la fin de la zone.`,
      choix: [
        ...ids.map((id) => ({
          id,
          libelle: IDOLES[id].nom,
          detail: `${IDOLES[id].malus} · ${IDOLES[id].bonus}`,
        })),
        { id: `partir`, libelle: `Ne pas tenter le sort` },
      ],
    });
    if (choix !== `partir`) {
      e.idole = { id: choix, zone: zone?.id };
      await ecranMessage(
        `🗿 ${IDOLES[choix].nom}`,
        `Jusqu'à la fin de la zone : ${IDOLES[choix].malus} ; ${IDOLES[choix].bonus}.`,
      );
    }
    return;
  }
  // avis de recherche : traque d'un archimonstre, ou prime si la zone n'en a pas
  let archi = zone ? zoneAArchis(zone) : false;
  let choix = await ecranRencontre({
    titre: `📜 Avis de recherche`,
    img: `/assets/divers/avis_de_recherche.png`,
    texte: archi
      ? `Un archimonstre rôde dans la zone. Un chasseur de primes te propose de le traquer.`
      : `Une bande de monstres est recherchée dans la zone, avec une belle prime à la clé.`,
    choix: [
      {
        id: `accepter`,
        libelle: archi ? `Traquer l'archimonstre` : `Accepter la prime`,
        detail: archi
          ? `Le prochain combat contiendra un archimonstre, mais ses monstres auront +20 % de PV.`
          : `Le prochain combat rapportera le double de kamas, mais ses monstres auront +20 % de PV.`,
      },
      { id: `partir`, libelle: `Décliner` },
    ],
  });
  if (choix === `accepter`) {
    e.traque = { zone: zone?.id, archi };
  }
}
// ---------- Donjon secret (ouvert avec une clé, après le boss d'une zone) ----------
async function jouerDonjonSecret(e, zone) {
  let secret = secretDuMonde(e.trancheId);
  if (!e.cle || !secret) {
    return;
  }
  let toile = numeroZone(zone.id);
  let r = recompensesSecret(toile);
  let derniere = getMonde(e.trancheId).zones.at(-1) === zone.id;
  let choix = await ecranRencontre({
    titre: `🗝️ ${secret.nom}`,
    img: MONSTRES[secret.bosses[0]]?.img,
    texte: `${secret.texte} Ta ${nomCle(e.trancheId)} tourne dans la serrure… Tu y entres avec les PV qu'il te reste.`,
    choix: [
      {
        id: `entrer`,
        libelle: `Entrer dans le donjon secret`,
        detail: `Plus fort que le donjon de la zone. Victoire : un objet du donjon (épique ou légendaire), ${r.kamas} kamas et de l'XP. Défaite : l'équipe est expulsée, la clé est perdue, mais la run continue.`,
      },
      derniere
        ? {
            id: `garder`,
            libelle: `Ne pas entrer`,
            detail: `La clé sera perdue à la fin de la run.`,
          }
        : {
            id: `garder`,
            libelle: `Garder la clé pour plus tard`,
            detail: `Plus tard, le donjon secret sera plus dur, mais rapportera plus.`,
          },
    ],
  });
  if (choix !== `entrer`) {
    return;
  }
  e.cle = false;
  e.stats.secrets = (e.stats.secrets ?? 0) + 1;
  let { gagne } = await jouerCombat(e, secret.combat, { type: `secret`, zone });
  if (!gagne) {
    let definitive = !!effetsDifficulte(e.ascension).mortDefinitive;
    for (let p of e.persos) {
      if (!(definitive && p.pvActuels <= 0)) {
        p.pvActuels = Math.max(1, p.pvActuels);
      }
    }
    await ecranMessage(
      `🗝️ Expulsés !`,
      `Les gardiens du ${secret.nom} ont repoussé l'équipe. La clé est perdue, mais l'aventure continue.`,
    );
    return;
  }
  ajouterKamas(e, Math.round(r.kamas * multiplicateurKamas(e) * bonusEquipeRun(meta, e).multKamas));
  gagnerXpEquipe(e, calculerXpCombat(r.xp, toile, e.trancheId));
  let id = secret.butin[Math.floor(Math.random() * secret.butin.length)];
  let obj = tirerObjet(id, Math.random, [tirerRareteSecret(Math.random)]);
  if (obj) {
    e.inventaire.push(obj);
    enregistrerCollection(meta, [obj]);
    e.stats.objets += 1;
    await ecranButin([obj]);
  }
  meta.secrets = [...new Set([...(meta.secrets ?? []), e.trancheId])];
  sauverMeta(meta);
  await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
}
async function resoudreZaap(pools, t) {
  let n = tirerTypeZaap(Math.random, t);
  await ecranZaap(ARTICLES_NOEUDS[n]);
  if (n === `combat`) {
    return {
      type: n,
      combatId: choixAleatoireMath(pools.normales),
      xp: XP_PAR_COMBAT.combat,
    };
  }
  if (n === `combat_dur`) {
    return {
      type: n,
      combatId: choixAleatoireMath(pools.elite),
      xp: XP_PAR_COMBAT.combat_dur,
    };
  }
  return {
    type: n,
    xp: 0,
  };
}
async function jouerZone(e, t, n) {
  enregistrerToileMax(meta, e.trancheId, n + 1);
  sauverMeta(meta);
  if (!e.carte) {
    e.carte = genererCarte(Math.random, t.pools, noeudsExclus(e, t), { premiereZone: n === 0 });
    sauverRun(n, e);
  }
  while (true) {
    let r = await ecranCarte(
      e.carte,
      e.persos,
      meta,
      t.nom,
      e.inventaire,
      e.kamas,
      e.ascension,
      e.philtres,
      () => sauverRun(n, e),
      effetsEnCours(e, t.id),
    );
    if (r === `accueil`) {
      return `accueil`;
    }
    if (r === `recommencer-memes` || r === `recommencer-choix`) {
      return r;
    }
    let { type } = r;
    let a = r.combatId;
    let o = r.xp ?? 0;
    if (type === `zaap`) {
      ({ type, combatId: a, xp: o } = await resoudreZaap(t.pools, noeudsExclus(e, t)));
    }
    let s = await resoudreNoeud(e, type, a, o, t, r.eliteModifs);
    r.visite = true;
    e.carte.courant = r.id;
    if (s === `wipe`) {
      return `wipe`;
    }
    if (s === `victoire`) {
      distribuerKamas(e, `donjon`, numeroZone(t.id));
      await jouerDonjonSecret(e, t);
      return `clear`;
    }
    sauverRun(n, e);
  }
}
async function jouerRun(e, t, n = 0, r = `t1`) {
  let i = getMonde(e ? e.run.trancheId : r);
  let a = zonesDuMonde(i);
  if (!a.length) {
    await ecranMessage(
      `🚧 En construction`,
      `${i.nom} n'a pas encore de zone : son contenu arrive dans un prochain chantier.`,
    );
    return null;
  }
  let o;
  let s = 0;
  if (e) {
    o = e.run;
    s = e.zoneIdx;
  } else {
    let e = t ?? (await ecranChoixEquipe());
    if (!e) {
      return null;
    }
    o = nouvelleRun(e, n, i.id);
  }
  fondDuMonde(i.id);
  try {
    for (let e = s; e < a.length; e++) {
      let t = a[e];
      let n = await jouerZone(o, t, e);
      if (n === `accueil`) {
        return null;
      }
      if (n === `recommencer-memes` || n === `recommencer-choix`) {
        effacerRun();
        enregistrerRun(meta, false);
        await traiterQuetes(o, verifierQuetesMeta(quetesMeta(), ctxMeta()));
        return {
          relancer:
            n === `recommencer-memes`
              ? (o.choixDepart ?? o.persos.slice(0, 2).map((e) => e.classeId))
              : `selection`,
          ascension: o.ascension,
          trancheId: i.id,
        };
      }
      if (n === `wipe`) {
        effacerRun();
        enregistrerRun(meta, false);
        await traiterQuetes(o, verifierQuetesMeta(quetesMeta(), ctxMeta()));
        await ecranRecap(o, false, quetesDeLaRun(o));
        return null;
      }
      soignerEquipe(o, 1);
      o.stats.zones += 1;
      await traiterQuetes(
        o,
        verifierQuetesZone(quetesMeta(), {
          zoneId: t.id,
          ascension: o.ascension,
        }),
      );
      o.carte = null;
      if (e < a.length - 1) {
        sauverRun(e + 1, o);
        await ecranMessage(
          `${t.nom} — vaincu !`,
          `Équipe soignée à 100 %. Tu pénètres dans ${a[e + 1].nom}.`,
        );
      }
    }
    effacerRun();
    enregistrerRun(meta, true, i.id);
    enregistrerAscension(meta, i.id, o.ascension);
    await traiterQuetes(o, verifierQuetesRun(quetesMeta(), contexteRun(o, i.id, true)));
    await traiterQuetes(o, verifierQuetesMeta(quetesMeta(), ctxMeta()));
    await ecranRecap(o, true, quetesDeLaRun(o));
    return null;
  } finally {
    fondDuMonde(null);
  }
}
async function boucleJeu() {
  // anciennes versions : les Dofus mis de côté par l'ancien ordre strict reviennent
  let rendus = rendreDofusSuspendus(meta);
  if (rendus.length) {
    await ecranMessage(
      `🥚 Dofus rendus`,
      `Les Dofus ne demandent plus ceux de niveau inférieur : chacun s'obtient dès que son succès est terminé, dans le monde de sa tranche de niveau. De retour (avec leur jet) : ${rendus.map((id) => DOFUS[id].nom).join(`, `)}.`,
    );
  }
  for (await traiterQuetes(null, verifierQuetesMeta(quetesMeta(), ctxMeta())); ;) {
    let e = chargerRun();
    let t = zonesDuMonde(getMonde(e?.run.trancheId ?? `t1`));
    let { action, ascension, trancheId } = await ecranAccueil(
      meta,
      () => reinitialiserDofus(meta),
      e
        ? {
            zoneNom: t[e.zoneIdx]?.nom ?? `?`,
            zoneNum: e.zoneIdx + 1,
            nbZones: t.length,
            ascension: e.run.ascension,
            trancheId: e.run.trancheId,
          }
        : null,
    );
    if (action === `abandonner`) {
      effacerRun();
      enregistrerRun(meta, false);
      continue;
    }
    let a = await jouerRun(action === `reprendre` ? e : null, undefined, ascension, trancheId);
    while (a?.relancer) {
      a = await jouerRun(
        null,
        a.relancer === `selection` ? undefined : a.relancer,
        a.ascension,
        a.trancheId,
      );
    }
  }
}
boucleJeu();
