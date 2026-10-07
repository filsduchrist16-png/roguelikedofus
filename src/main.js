import { CLASSES, COMBATS, MONSTRES } from "./data/index.js";
import { XP_PAR_COMBAT, calculerXpCombat, getMonde, zonesDuMonde } from "./jeu/config.js";
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
  recruter,
  soignerEquipe,
  synchroniserPv,
  tirerArchis,
  tirerButin,
  tirerMonstreRare,
  tirerRecrues,
} from "./jeu/run.js";
import { chargerRun, effacerRun, sauverRun } from "./sauvegarde/run.js";
import { ajouterKamas, gainKamas, genererStockHdv, numeroZone } from "./jeu/economie.js";
import {
  ajouterDofus,
  appliquerBonusDofus,
  bonusDofus,
  capturerArchi,
  chargerMeta,
  dofusAGagner,
  dofusPossedes,
  enregistrerAscension,
  enregistrerCollection,
  enregistrerRun,
  enregistrerToileMax,
  pctSoinTaverne,
  prospectionMoyenne,
  reinitialiserDofus,
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
  enregistrerFx,
  initialiserVueCombat,
  installerInfobulleSorts,
  installerRaccourcisCombat,
  journaliser,
  rafraichirCombat,
} from "./ui/combat.js";
import { ecranButin } from "./ui/ecrans/butin.js";
import { ecranCaptureArchi, ecranReliques } from "./ui/ecrans/recompenses.js";
import { afficherBandeauQuete, ecranSuccesObtenu } from "./ui/ecrans/succes.js";
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
    await ecranSuccesObtenu(e.def, r);
  }
  sauverMeta(meta);
  if (n) {
    await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
  }
}
function contexteRun(e, trancheId, victoire) {
  let r = [`arme`, `coiffe`, `cape`, `anneau`];
  return {
    trancheId,
    victoire,
    ascension: e.ascension,
    tavernes: e.stats.tavernes ?? 0,
    recrutements: e.stats.recrutements ?? 0,
    tailleEquipe: e.persos.length,
    classes: e.persos.map((e) => e.classeId),
    quatreHerosEquipes:
      e.persos.length === 4 && e.persos.every((e) => r.every((t) => e.equipement[t])),
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
  let a = monstresDuCombat(combatId);
  appliquerDifficulteMonstres(a, effetsDifficulte(e.ascension), {
    type: n.type,
    especesZone: n.zone ? especesNormalesZone(n.zone) : undefined,
    rng: Math.random,
  });
  if (n.elite) {
    let e = appliquerAffixesElite(a, Math.random, n.eliteModifs);
    r = `${r} · ${e.map((e) => `${e.nom} (${e.desc})`).join(` · `)}`;
  }
  tirerArchis(a, Math.random, chanceArchi(e));
  let o = tirerMonstreRare(a, Math.random, {
    type: n.type,
    tranche: e.trancheId,
  });
  if (o) {
    r = `${r} · ⭐ ${o}`;
  }
  let s = bonusDofus(meta);
  appliquerBonusDofus(i, s);
  let c = [...i, ...a];
  initialiserVueCombat(c, r, meta);
  let l = nouveauSuiviCombat();
  let herosVivantsAuDepart = i.filter((e) => e.pvActuels > 0).map((e) => e.ref);
  let gagne = await executerCombat(c, {
    onEvenement: (e) => suivreEvenement(l, e, c),
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
    enemyDamageBonus: effetsDifficulte(e.ascension).degatsMult ?? 1,
    reliquesActives: dofusPossedes(meta),
  });
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
      prospectionMoyenne(e, bonusDofus(meta).prospection),
      Math.random,
    );
    if (t.length) {
      sauverMeta(meta);
      e.stats.reliques.push(...t);
      await ecranReliques(t);
    }
  }
  await traiterQuetes(
    e,
    verifierQuetesCombat(
      quetesMeta(),
      resumeCombat(l, {
        combattants: c,
        herosVivantsAuDepart,
        gagne,
        combatId,
        noeud: n.type,
        zoneId: n.zone?.id,
        classes: e.persos.map((e) => e.classeId),
        ascension: e.ascension,
      }),
    ),
  );
  await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
  return {
    gagne,
    combatants: c,
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
  let prospection = bonusDofus(meta).prospection;
  let a = tirerButin(e, t, n, Math.random, r, prospection);
  enregistrerCollection(meta, a);
  e.stats.objets += a.length;
  if (a.length) {
    await ecranButin(a);
  }
}
function distribuerKamas(e, t, n) {
  ajouterKamas(
    e,
    Math.round(gainKamas(t, n, Math.random) * multiplicateurKamas(e) * bonusDofus(meta).multKamas),
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
};
async function resoudreNoeud(e, type, n, r, zone, eliteModifs) {
  let o = zone?.id;
  switch (type) {
    case `combat`:
    case `combat_dur`: {
      let { gagne } = await jouerCombat(e, n, {
        elite: type === `combat_dur`,
        eliteModifs,
        type,
        zone,
      });
      if (!gagne) {
        return `wipe`;
      }
      let c = o ? numeroZone(o) : 1;
      distribuerKamas(e, type, c);
      gagnerXpEquipe(e, calculerXpCombat(r, c, e.trancheId));
      await distribuerButin(e, o, type, type === `combat_dur` ? `donjon` : undefined);
      await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
      return `continue`;
    }
    case `taverne`: {
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
      let { gagne } = await jouerCombat(e, n, {
        type: `donjon`,
        zone,
      });
      if (gagne) {
        return (
          await distribuerButin(e, o, type),
          await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta())),
          `victoire`
        );
      }
      return `wipe`;
    }
    default:
      return `continue`;
  }
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
    e.carte = genererCarte(Math.random, t.pools, noeudsExclus(e, t));
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
