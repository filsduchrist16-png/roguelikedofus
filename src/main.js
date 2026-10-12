import { ctxMeta, etatRun, meta, quetesMeta } from "./deroule/etat.js";
import { DOFUS } from "./data/index.js";
import { getMonde, zonesDuMonde } from "./jeu/config.js";
import { genererCarte } from "./carte/generation.js";
import { verifierQuetesMeta, verifierQuetesRun, verifierQuetesZone } from "./jeu/quetes.js";
import { noeudsExclus, nouvelleRun, soignerEquipe } from "./jeu/run.js";
import { chargerRun, effacerRun, sauverRun } from "./sauvegarde/run.js";
import { numeroZone } from "./jeu/economie.js";
import {
  enregistrerAscension,
  enregistrerRecord,
  enregistrerRun,
  enregistrerToileMax,
  reinitialiserDofus,
  rendreDofusSuspendus,
  sauverMeta,
} from "./sauvegarde/meta.js";
import {
  definirRacine,
  fondDuMonde,
  installerInfobulleAide,
  installerInfobulleDofus,
  installerRetourTelephone,
  installerToucheEchap,
  parametres,
} from "./ui/commun.js";
import { installerInfobulleSorts, installerRaccourcisCombat } from "./ui/combat.js";
import { scoreRun } from "./jeu/idolesDepart.js";
import { benedictionDuJour, cleRecordJour, dateDuJour, rngCarteDuJour } from "./jeu/runDuJour.js";
import { effetsEnCours } from "./jeu/rencontres.js";
import { afficherBandeau } from "./ui/ecrans/succes.js";
import { ecranAccueil } from "./ui/ecrans/accueil.js";
import { ecranChoixEquipe } from "./ui/ecrans/choixEquipe.js";
import { ecranMessage } from "./ui/ecrans/message.js";
import { ecranConnexion } from "./ui/ecrans/connexion.js";
import { connexionRequise } from "./sauvegarde/compte.js";
import { ecranCarte } from "./ui/ecrans/carte.js";
import { deblocagesVictoire, ecranRecap, etatDeblocage } from "./ui/ecrans/recap.js";
import { installerSons } from "./son.js";
import { CLES_TUTO, appliquerAccessibilite, sauverParametres } from "./sauvegarde/parametres.js";
import { traiterQuetes, contexteRun, quetesDeLaRun } from "./deroule/quetes.js";
import { jouerDonjonSecret } from "./deroule/secret.js";
import { resoudreNoeud, resoudreZaap } from "./deroule/noeud.js";
import "./style.css";
import "./interface.css";
import "./visuel.css";
import "./confort-run.css";
import "./confort-carte.css";
import "./confort-combat.css";
import "./confort-inventaire.css";
import "./confort-meta.css";
import "./confort-ecrans.css";
function initialiserInterface(elementApp) {
  definirRacine(elementApp);
  fondDuMonde(null);
  // taille du texte et couleurs adaptées (réglages d'accessibilité)
  appliquerAccessibilite(parametres);
  installerInfobulleDofus();
  installerInfobulleSorts();
  installerInfobulleAide();
  installerRaccourcisCombat();
  installerToucheEchap();
  installerRetourTelephone();
  installerSons(parametres.sons);
}
const elementApp = document.getElementById(`app`);
if (!elementApp) {
  throw Error(`#app introuvable`);
}
initialiserInterface(elementApp);
// astuces de première partie : un joueur qui a déjà fini une run (ancienne sauvegarde) ne les revoit pas
if (parametres.vuTuto === null) {
  parametres.vuTuto = Object.fromEntries(CLES_TUTO.map((k) => [k, meta.runs > 0]));
  sauverParametres(parametres);
}
// Hors combat seulement : en plein combat l'état est partiel, la run reprend au dernier nœud.
document.addEventListener(`visibilitychange`, () => {
  if (
    document.visibilityState === `hidden` &&
    etatRun.active &&
    !document.querySelector(`#app .combat`)
  ) {
    sauverRun(etatRun.active.zoneIdx, etatRun.active.run);
  }
});
async function jouerZone(e, t, n) {
  etatRun.active = { zoneIdx: n, run: e };
  enregistrerToileMax(meta, e.trancheId, n + 1);
  sauverMeta(meta);
  if (!e.carte) {
    // run du jour : la carte de la zone vient de la graine du jour
    e.carte = genererCarte(
      e.jour ? rngCarteDuJour(e.jour, e.trancheId, n) : Math.random,
      t.pools,
      noeudsExclus(e, t),
      { premiereZone: n === 0 },
    );
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
      {
        zoneNum: n + 1,
        nbZones: zonesDuMonde(getMonde(e.trancheId)).length,
        tierObjets: numeroZone(t.id),
      },
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
      await jouerDonjonSecret(e, t);
      return `clear`;
    }
    sauverRun(n, e);
  }
}
// Score record du monde (zones franchies, difficulté et idoles de départ) : prévient s'il est battu.
function noterRecord(run, trancheId, zones, victoire) {
  const score = scoreRun({
    zones,
    victoire,
    ascension: run.ascension,
    idoles: run.idolesDepart,
  });
  // run du jour : son propre record (par jour et par monde), à part du record du monde
  const cle = run.jour ? cleRecordJour(run.jour, trancheId) : trancheId;
  if (enregistrerRecord(meta, cle, score, run.idolesDepart, run.ascension)) {
    afficherBandeau(
      run.jour
        ? `🏆 Nouveau record de la run du jour : ${score} points`
        : `🏆 Nouveau record du monde : ${score} points`,
    );
  }
}
async function jouerRun(e, t, n = 0, r = `t1`, idoles = [], jour = false) {
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
    // run du jour : graine et bénédiction du jour, sans idole de départ (scores comparables)
    let date = jour ? dateDuJour() : null;
    o = nouvelleRun(
      e,
      n,
      i.id,
      jour ? [] : idoles,
      date ? { date, benediction: benedictionDuJour(date) } : null,
    );
    // dernier départ retenu : l'accueil et le choix d'équipe le proposent par défaut
    parametres.dernierDepart = { trancheId: i.id, ascension: n, classes: [...e] };
    sauverParametres(parametres);
  }
  // relance demandée depuis le récapitulatif de fin de run
  let relance = (choix) =>
    choix === `memes`
      ? {
          relancer: o.choixDepart ?? o.persos.slice(0, 2).map((e) => e.classeId),
          ascension: o.ascension,
          trancheId: i.id,
          idoles: o.idolesDepart,
        }
      : choix === `choix`
        ? { relancer: `selection`, ascension: o.ascension, trancheId: i.id, idoles: o.idolesDepart }
        : null;
  fondDuMonde(i.id);
  try {
    for (let e = s; e < a.length; e++) {
      let t = a[e];
      let n = await jouerZone(o, t, e);
      etatRun.active = null;
      if (n === `accueil`) {
        return null;
      }
      if (n === `recommencer-memes` || n === `recommencer-choix`) {
        etatRun.active = null;
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
          idoles: o.idolesDepart,
        };
      }
      if (n === `wipe`) {
        etatRun.active = null;
        effacerRun();
        enregistrerRun(meta, false);
        noterRecord(o, i.id, o.stats.zones, false);
        await traiterQuetes(o, verifierQuetesMeta(quetesMeta(), ctxMeta()));
        return relance(await ecranRecap(o, false, quetesDeLaRun(o)));
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
        etatRun.active = { zoneIdx: e + 1, run: o };
        await ecranMessage(
          `${t.nom} — vaincu !`,
          `Équipe soignée à 100 %. Zone ${e + 2}/${a.length} : tu pénètres dans ${a[e + 1].nom}.`,
        );
      }
    }
    etatRun.active = null;
    effacerRun();
    enregistrerRun(meta, true, i.id);
    let avant = etatDeblocage(meta, i.id);
    enregistrerAscension(meta, i.id, o.ascension);
    noterRecord(o, i.id, a.length, true);
    let debloques = deblocagesVictoire(avant, etatDeblocage(meta, i.id));
    await traiterQuetes(o, verifierQuetesRun(quetesMeta(), contexteRun(o, i.id, true)));
    await traiterQuetes(o, verifierQuetesMeta(quetesMeta(), ctxMeta()));
    return relance(await ecranRecap(o, true, quetesDeLaRun(o), debloques));
  } finally {
    etatRun.active = null;
    fondDuMonde(null);
  }
}
async function boucleJeu() {
  // page de connexion en première page (hors claude.ai, où le compte claude.ai suffit)
  if (typeof globalThis.claude?.use !== `function` && connexionRequise()) {
    await ecranConnexion();
  }
  // anciennes versions : les Dofus mis de côté par l'ancien ordre strict reviennent
  let rendus = rendreDofusSuspendus(meta);
  if (rendus.length) {
    await ecranMessage(
      `🥚 Dofus rendus`,
      `Les Dofus ne demandent plus ceux de niveau inférieur : chacun s'obtient dès que son succès est terminé, dans le monde de sa tranche de niveau. De retour (avec leur jet) : ${rendus.map((id) => DOFUS[id].nom).join(`, `)}.`,
    );
  }
  for (await traiterQuetes(null, verifierQuetesMeta(quetesMeta(), ctxMeta())); ;) {
    try {
      let e = chargerRun();
      let t = zonesDuMonde(getMonde(e?.run.trancheId ?? `t1`));
      let { action, ascension, trancheId, idoles, jour } = await ecranAccueil(
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
      let a = await jouerRun(
        action === `reprendre` ? e : null,
        undefined,
        ascension,
        trancheId,
        idoles,
        !!jour,
      );
      while (a?.relancer) {
        a = await jouerRun(
          null,
          a.relancer === `selection` ? undefined : a.relancer,
          a.ascension,
          a.trancheId,
          a.idoles,
        );
      }
    } catch (erreur) {
      // une exception dans un écran ou dans le moteur ne doit pas figer le jeu : on le dit et on revient à l'accueil
      console.error(erreur);
      try {
        await ecranMessage(
          `Oups`,
          `Une erreur est survenue (${String(erreur?.message ?? erreur).slice(0, 120)}). Retour à l'accueil.`,
        );
      } catch {}
    }
  }
}

window.addEventListener(`rld-sauvegarde-echec`, () =>
  afficherBandeau(`⚠ Sauvegarde impossible : le stockage du navigateur est plein ou bloqué`),
);
window.addEventListener(`unhandledrejection`, (ev) => console.error(ev.reason));
boucleJeu();
