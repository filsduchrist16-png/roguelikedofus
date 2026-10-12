import { etatRun, meta } from "./etat.js";
import { sauverRun } from "../sauvegarde/run.js";
import { enregistrerToileMax, sauverMeta, enregistrerRecord } from "../sauvegarde/meta.js";
import { genererCarte } from "../carte/generation.js";
import { rngCarteDuJour, cleRecordJour } from "../jeu/runDuJour.js";
import { noeudsExclus } from "../jeu/run.js";
import { ecranCarte } from "../ui/ecrans/carte.js";
import { effetsEnCours } from "../jeu/rencontres.js";
import { zonesDuMonde, getMonde } from "../jeu/config.js";
import { numeroZone } from "../jeu/economie.js";
import { resoudreZaap, resoudreNoeud } from "./noeud.js";
import { jouerDonjonSecret } from "./secret.js";
import { scoreRun } from "../jeu/idolesDepart.js";
import { afficherBandeau } from "../ui/ecrans/succes.js";

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
export async function jouerZone(e, t, n) {
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
export function noterRecord(run, trancheId, zones, victoire) {
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
