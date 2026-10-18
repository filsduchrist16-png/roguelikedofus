import { etatRun, meta } from "./etat.js";
import { sauverRun } from "../sauvegarde/run.js";
import { enregistrerToileMax, sauverMeta, enregistrerRecord } from "../sauvegarde/meta.js";
import { genererCarte } from "../carte/generation.js";
import { rngCarteDuJour, cleRecordJour } from "../jeu/runDuJour.js";
import { assurerAffixePermanent, noeudsExclus } from "../jeu/run.js";
import { ecranCarte } from "../ui/ecrans/carte.js";
import { effetsEnCours } from "../jeu/rencontres.js";
import { zonesDuMonde, getMonde } from "../jeu/config.js";
import { numeroZone } from "../jeu/economie.js";
import { resoudreZaap, resoudreNoeud } from "./noeud.js";
import { jouerDonjonSecret } from "./secret.js";
import { scoreRun } from "../jeu/idolesDepart.js";
import { afficherBandeau } from "../ui/ecrans/succes.js";
import { proposerOffreCombat } from "./recompenses.js";

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
export async function jouerZone(run, zone, indexZone) {
  etatRun.active = { zoneIdx: indexZone, run };
  // Ultime : l'affixe permanent est tiré dès la première carte (affiché dans les effets en cours)
  assurerAffixePermanent(run);
  enregistrerToileMax(meta, run.trancheId, indexZone + 1);
  sauverMeta(meta);
  if (!run.carte) {
    // run du jour : la carte de la zone vient de la graine du jour
    run.carte = genererCarte(
      run.jour ? rngCarteDuJour(run.jour, run.trancheId, indexZone) : Math.random,
      zone.pools,
      noeudsExclus(run, zone),
      { premiereZone: indexZone === 0 },
    );
    sauverRun(indexZone, run);
  }
  while (true) {
    // reprise d'une sauvegarde faite pendant le choix de récompense : la même offre revient
    await proposerOffreCombat(run, indexZone);
    let noeud = await ecranCarte(
      run.carte,
      run.persos,
      meta,
      zone.nom,
      run.inventaire,
      run.kamas,
      run.ascension,
      run.philtres,
      () => sauverRun(indexZone, run),
      effetsEnCours(run, zone.id),
      {
        zoneNum: indexZone + 1,
        nbZones: zonesDuMonde(getMonde(run.trancheId)).length,
        tierObjets: numeroZone(zone.id),
      },
    );
    if (noeud === `accueil`) {
      return `accueil`;
    }
    if (noeud === `recommencer-memes` || noeud === `recommencer-choix`) {
      return noeud;
    }
    let { type } = noeud;
    let combatId = noeud.combatId;
    let xp = noeud.xp ?? 0;
    if (type === `zaap`) {
      ({ type, combatId, xp } = await resoudreZaap(zone.pools, noeudsExclus(run, zone)));
    }
    let issue = await resoudreNoeud(run, type, combatId, xp, zone, noeud.eliteModifs);
    noeud.visite = true;
    run.carte.courant = noeud.id;
    if (issue === `wipe`) {
      return `wipe`;
    }
    if (issue === `victoire`) {
      await jouerDonjonSecret(run, zone);
      return `clear`;
    }
    // nœud marqué visité d'abord : recharger pendant le choix ne rejoue pas le combat
    await proposerOffreCombat(run, indexZone);
    sauverRun(indexZone, run);
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
