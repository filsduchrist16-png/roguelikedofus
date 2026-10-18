import { getMonde, zonesDuMonde } from "../jeu/config.js";
import { ecranMessage } from "../ui/ecrans/message.js";
import { ecranChoixEquipe } from "../ui/ecrans/choixEquipe.js";
import { dateDuJour, benedictionDuJour } from "../jeu/runDuJour.js";
import { nouvelleRun, soignerEquipe } from "../jeu/run.js";
import { parametres, fondDuMonde } from "../ui/commun.js";
import { sauverParametres } from "../sauvegarde/parametres.js";
import { jouerZone, noterRecord } from "./zone.js";
import { etatRun, meta, quetesMeta, ctxMeta } from "./etat.js";
import { effacerRun, sauverRun } from "../sauvegarde/run.js";
import { enregistrerRun, enregistrerAscension } from "../sauvegarde/meta.js";
import { traiterQuetes, quetesDeLaRun, contexteRun } from "./quetes.js";
import { verifierQuetesMeta, verifierQuetesZone, verifierQuetesRun } from "../jeu/quetes.js";
import { ecranRecap, etatDeblocage, deblocagesVictoire } from "../ui/ecrans/recap.js";
import { noterAlmanax, verserAlmanax } from "./almanax.js";

export async function jouerRun(
  sauvegarde,
  classesImposees,
  ascension = 0,
  trancheIdDemande = `t1`,
  idoles = [],
  jour = false,
) {
  let monde = getMonde(sauvegarde ? sauvegarde.run.trancheId : trancheIdDemande);
  let zones = zonesDuMonde(monde);
  if (!zones.length) {
    await ecranMessage(
      `🚧 En construction`,
      `${monde.nom} n'a pas encore de zone : son contenu arrive dans un prochain chantier.`,
    );
    return null;
  }
  let run;
  let zoneDepart = 0;
  if (sauvegarde) {
    run = sauvegarde.run;
    zoneDepart = sauvegarde.zoneIdx;
  } else {
    let classes = classesImposees ?? (await ecranChoixEquipe());
    if (!classes) {
      return null;
    }
    // run du jour : graine et bénédiction du jour, sans idole de départ (scores comparables)
    let date = jour ? dateDuJour() : null;
    run = nouvelleRun(
      classes,
      ascension,
      monde.id,
      jour ? [] : idoles,
      date ? { date, benediction: benedictionDuJour(date) } : null,
    );
    // dernier départ retenu : l'accueil et le choix d'équipe le proposent par défaut
    parametres.dernierDepart = { trancheId: monde.id, ascension, classes: [...classes] };
    sauverParametres(parametres);
    // Almanax accompli : sa récompense revient à la run qui commence (pas à la run du jour, dont
    // les scores restent comparables)
    if (!jour) {
      verserAlmanax(meta, run);
    }
  }
  // relance demandée depuis le récapitulatif de fin de run
  let relance = (choix) =>
    choix === `memes`
      ? {
          relancer: run.choixDepart ?? run.persos.slice(0, 2).map((perso) => perso.classeId),
          ascension: run.ascension,
          trancheId: monde.id,
          idoles: run.idolesDepart,
        }
      : choix === `choix`
        ? {
            relancer: `selection`,
            ascension: run.ascension,
            trancheId: monde.id,
            idoles: run.idolesDepart,
          }
        : null;
  fondDuMonde(monde.id);
  try {
    for (let indexZone = zoneDepart; indexZone < zones.length; indexZone++) {
      let zone = zones[indexZone];
      let issue = await jouerZone(run, zone, indexZone);
      etatRun.active = null;
      if (issue === `accueil`) {
        return null;
      }
      if (issue === `recommencer-memes` || issue === `recommencer-choix`) {
        etatRun.active = null;
        effacerRun();
        enregistrerRun(meta, false);
        await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
        return {
          relancer:
            issue === `recommencer-memes`
              ? (run.choixDepart ?? run.persos.slice(0, 2).map((perso) => perso.classeId))
              : `selection`,
          ascension: run.ascension,
          trancheId: monde.id,
          idoles: run.idolesDepart,
        };
      }
      if (issue === `wipe`) {
        etatRun.active = null;
        effacerRun();
        enregistrerRun(meta, false);
        noterRecord(run, monde.id, run.stats.zones, false);
        await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
        return relance(await ecranRecap(run, false, quetesDeLaRun(run)));
      }
      soignerEquipe(run, 1);
      run.stats.zones += 1;
      noterAlmanax(meta, `zone`);
      await traiterQuetes(
        run,
        verifierQuetesZone(quetesMeta(), {
          zoneId: zone.id,
          ascension: run.ascension,
        }),
      );
      run.carte = null;
      if (indexZone < zones.length - 1) {
        sauverRun(indexZone + 1, run);
        etatRun.active = { zoneIdx: indexZone + 1, run };
        await ecranMessage(
          `${zone.nom} — vaincu !`,
          `Équipe soignée à 100 %. Zone ${indexZone + 2}/${zones.length} : tu pénètres dans ${zones[indexZone + 1].nom}.`,
        );
      }
    }
    etatRun.active = null;
    effacerRun();
    enregistrerRun(meta, true, monde.id);
    let avant = etatDeblocage(meta, monde.id);
    enregistrerAscension(meta, monde.id, run.ascension);
    noterRecord(run, monde.id, zones.length, true);
    let debloques = deblocagesVictoire(avant, etatDeblocage(meta, monde.id));
    await traiterQuetes(run, verifierQuetesRun(quetesMeta(), contexteRun(run, monde.id, true)));
    await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
    return relance(await ecranRecap(run, true, quetesDeLaRun(run), debloques));
  } finally {
    etatRun.active = null;
    fondDuMonde(null);
  }
}
