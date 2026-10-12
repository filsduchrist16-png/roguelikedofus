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

export async function jouerRun(e, t, n = 0, r = `t1`, idoles = [], jour = false) {
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
