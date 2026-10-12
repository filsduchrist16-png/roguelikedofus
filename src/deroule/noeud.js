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
  soignerAvecGain,
} from "./recompenses.js";
import { calculerXpCombat, CONFIG_ARCHI, XP_PAR_COMBAT } from "../jeu/config.js";
import { texteBilan } from "../ui/finCombat.js";
import { secretDuMonde, CHANCES_CLE, nomCle } from "../jeu/secret.js";
import { ecranMessage } from "../ui/ecrans/message.js";
import { traiterQuetes } from "./quetes.js";
import { verifierQuetesMeta } from "../jeu/quetes.js";
import { quetesMeta, ctxMeta, meta, choixAleatoireMath } from "./etat.js";
import { pctSoinTaverne } from "../sauvegarde/meta.js";
import { ecranTaverne } from "../ui/ecrans/taverne.js";
import { afficherBandeau } from "../ui/ecrans/succes.js";
import { CLASSES } from "../data/index.js";
import { ecranHdv } from "../ui/ecrans/hdv.js";
import { ecranForgemagie } from "../ui/ecrans/forgemagie.js";
import { jouerRencontre } from "./rencontres.js";
import { tirerTypeZaap } from "../carte/generation.js";

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
};
export async function resoudreNoeud(run, type, combatId, xpCombat, zone, eliteModifs) {
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
      let numZone = zoneId ? numeroZone(zoneId) : 1;
      let idole = idoleActive(run, zoneId);
      let bonusDefi = defiOk ? 1 + BONUS_DEFI : 1;
      let kamas = distribuerKamas(
        run,
        type,
        numZone,
        bonusDefi * (idole?.kamasMult ?? 1) * (prime ? 2 : 1),
      );
      let { xp, niveaux } = gagnerXpEquipe(
        run,
        Math.round(
          calculerXpCombat(xpCombat, numZone, run.trancheId) * bonusDefi * (idole?.xpMult ?? 1),
        ),
      );
      await distribuerButin(
        run,
        zoneId,
        type,
        type === `combat_dur` ? `donjon` : undefined,
        texteBilan({ xp, kamas, defiOk, niveaux }),
      );
      if (
        type === `combat_dur` &&
        !run.cle &&
        secretDuMonde(run.trancheId) &&
        Math.random() < CHANCES_CLE.combatDur
      ) {
        run.cle = true;
        await ecranMessage(
          `🗝️ ${nomCle(run.trancheId)}`,
          `Un des monstres portait une clé : elle ouvre le donjon secret du monde, ${secretDuMonde(run.trancheId).nom}.`,
        );
      }
      await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
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
      let pctSoin = pctSoinTaverne(run.ascension);
      let effets = effetsDifficulte(run.ascension);
      let recrues = tirerRecrues(run, Math.random);
      let choix = await ecranTaverne(
        run.persos,
        recrues,
        pctSoin,
        !!effets.mortDefinitive,
        !!effets.tavernesCoupeesAPlein,
      );
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
      let { xp, niveaux } = gagnerXpEquipe(
        run,
        Math.round(
          calculerXpCombat(XP_PAR_COMBAT.donjon, zoneId ? numeroZone(zoneId) : 1, run.trancheId) *
            bonusDefi *
            (idoleDonjon?.xpMult ?? 1),
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
    case `rencontre`:
      await jouerRencontre(run, zone);
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
