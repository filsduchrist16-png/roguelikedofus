// Déroulé des Songes infinis : écran entre deux étages, combat de l'étage, récompenses, paliers,
// fin de la tentative et record. La logique pure est dans src/jeu/songes.js.
import {
  MONDE_SONGES,
  appliquerRecompense,
  equiperKit,
  franchirEtage,
  genererEtage,
  kamasDepartSonges,
  nouvelleRunSonges,
  recordSonges,
  scoreSonges,
} from "../jeu/songes.js";
import { getMonde } from "../jeu/config.js";
import { pvMaxPerso, recruter, tirerRecrues } from "../jeu/run.js";
import { genererStockHdv } from "../jeu/economie.js";
import { BONUS_DEFI } from "../jeu/defis.js";
import { verifierQuetesMeta } from "../jeu/quetes.js";
import { enregistrerCollection, enregistrerRecord, enregistrerRun } from "../sauvegarde/meta.js";
import { effacerRun, sauverRun } from "../sauvegarde/run.js";
import { CLASSES } from "../data/index.js";
import { fondDuMonde } from "../ui/commun.js";
import { ecranChoixEquipe } from "../ui/ecrans/choixEquipe.js";
import { ecranTaverne } from "../ui/ecrans/taverne.js";
import { ecranHdv } from "../ui/ecrans/hdv.js";
import { ecranRecap, noterObjetsObtenus } from "../ui/ecrans/recap.js";
import { ecranSonge } from "../ui/ecrans/songes.js";
import { afficherBandeau } from "../ui/ecrans/succes.js";
import { etatRun, meta, quetesMeta, ctxMeta } from "./etat.js";
import { jouerCombat } from "./combat.js";
import { distribuerKamas } from "./recompenses.js";
import { traiterQuetes, quetesDeLaRun } from "./quetes.js";
import { soinFinCombat } from "../jeu/recompensesRun.js";

// Zone dont l'HDV d'un palier tire son stock : la dernière du Monde 5 (objets épiques et légendaires).
const zoneHdv = () => getMonde(MONDE_SONGES).zones.at(-1);
// Toile des kamas gagnés en combat : celle de la dernière zone du jeu.
const TOILE_SONGES = 60;

/**
 * Joue une tentative (nouvelle ou reprise). Renvoie null (accueil) ou { songes: true, relancer }
 * (classes à relancer, ou `selection` pour choisir une autre équipe).
 */
export async function jouerSonges(sauvegarde, classesImposees) {
  let run;
  if (sauvegarde) {
    run = sauvegarde.run;
  } else {
    const classes = classesImposees ?? (await ecranChoixEquipe());
    if (!classes) {
      return null;
    }
    run = nouvelleRunSonges(classes, Math.random, kamasDepartSonges(meta));
    // record avant la tentative : pour annoncer un nouveau record à la fin
    run.recordDepart = recordSonges(meta);
  }
  fondDuMonde(MONDE_SONGES);
  try {
    while (true) {
      sauverRun(0, run);
      etatRun.active = { zoneIdx: 0, run };
      const choix = await ecranSonge(run, meta, () => sauverRun(0, run));
      if (choix.type === `accueil`) {
        return null;
      }
      if (choix.type === `recompense`) {
        choisirRecompense(run, choix.indice);
        continue;
      }
      if (choix.type === `taverne`) {
        await palierTaverne(run);
        continue;
      }
      if (choix.type === `hdv`) {
        run.palierSonge = { ...run.palierSonge, hdv: true };
        await ecranHdv(run, genererStockHdv(zoneHdv(), Math.random), meta);
        await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
        continue;
      }
      // combat de l'étage : on quitte le palier, la récompense a été prise
      run.offreSonge = null;
      run.palierSonge = null;
      sauverRun(0, run);
      if (!(await jouerEtage(run))) {
        return await finDuSonge(run);
      }
    }
  } finally {
    etatRun.active = null;
    fondDuMonde(null);
  }
}

function choisirRecompense(run, indice) {
  const recompense = run.offreSonge?.[indice];
  if (!recompense) {
    return;
  }
  const texte = appliquerRecompense(run, recompense);
  if (recompense.type === `objet` && recompense.objet) {
    enregistrerCollection(meta, [recompense.objet]);
    run.stats.objets += 1;
    noterObjetsObtenus(run.stats, [recompense.objet]);
  }
  run.offreSonge = null;
  if (texte) {
    afficherBandeau(texte);
  }
}

async function palierTaverne(run) {
  run.palierSonge = { ...run.palierSonge, taverne: true };
  run.stats.tavernes = (run.stats.tavernes ?? 0) + 1;
  // l'équipe vient d'être soignée à 100 % : la taverne sert surtout à recruter
  const choix = await ecranTaverne(run.persos, tirerRecrues(run, Math.random), 1);
  if (choix.type !== `recrue`) {
    afficherBandeau(`🍺 L'équipe était déjà en pleine forme`);
    return;
  }
  recruter(run, choix.classeId, choix.remplace);
  run.stats.recrutements = (run.stats.recrutements ?? 0) + 1;
  // la recrue arrive au niveau maximal avec son propre kit de départ
  const recrue = run.persos.find((perso) => perso.classeId === choix.classeId);
  if (recrue) {
    equiperKit(recrue, Math.random);
    recrue.pvActuels = pvMaxPerso(recrue);
  }
  afficherBandeau(
    `🍺 Recrue ! ${CLASSES[choix.classeId].nom} rejoint l'équipe${choix.remplace ? ` à la place de ${CLASSES[choix.remplace]?.nom ?? choix.remplace}` : ``}`,
  );
}

// Renvoie true si l'étage est franchi.
async function jouerEtage(run) {
  const etage = genererEtage(run.etage, Math.random);
  const { gagne, defiOk } = await jouerCombat(run, etage.combatId, {
    type: etage.type,
    songe: { etage: etage.etage, facteur: etage.facteur, affixes: run.affixesSonge },
  });
  if (!gagne) {
    return false;
  }
  // relique de run « Bandages » : seul soin après une victoire dans les Songes
  soinFinCombat(run);
  const kamas = distribuerKamas(
    run,
    etage.boss ? `donjon` : `combat`,
    TOILE_SONGES,
    defiOk ? 1 + BONUS_DEFI : 1,
  );
  const { affixe, palier } = franchirEtage(run, Math.random);
  // record tenu à jour à chaque étage : une tentative abandonnée garde son score
  enregistrerRecord(meta, `songes`, scoreSonges(run.etage));
  sauverRun(0, run);
  await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
  afficherBandeau(
    `Étage ${etage.etage} franchi : +${kamas} kamas${palier ? ` · palier, équipe soignée` : ``}${affixe ? ` · nouvel affixe de songe` : ``}`,
  );
  return true;
}

async function finDuSonge(run) {
  etatRun.active = null;
  effacerRun();
  enregistrerRun(meta, false);
  const score = scoreSonges(run.etage);
  enregistrerRecord(meta, `songes`, score);
  await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
  const choix = await ecranRecap(run, false, quetesDeLaRun(run), [], {
    etage: score,
    record: recordSonges(meta),
    nouveauRecord: score > 0 && score > (run.recordDepart ?? 0),
  });
  const classes = run.choixDepart ?? run.persos.slice(0, 2).map((perso) => perso.classeId);
  return choix === `memes`
    ? { songes: true, relancer: classes }
    : choix === `choix`
      ? { songes: true, relancer: `selection` }
      : null;
}
