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
export async function resoudreNoeud(e, type, n, r, zone, eliteModifs) {
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
      let kamas = distribuerKamas(
        e,
        type,
        c,
        bonusDefi * (idole?.kamasMult ?? 1) * (prime ? 2 : 1),
      );
      let { xp, niveaux } = gagnerXpEquipe(
        e,
        Math.round(calculerXpCombat(r, c, e.trancheId) * bonusDefi * (idole?.xpMult ?? 1)),
      );
      await distribuerButin(
        e,
        o,
        type,
        type === `combat_dur` ? `donjon` : undefined,
        texteBilan({ xp, kamas, defiOk, niveaux }),
      );
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
      if (effetsDifficulte(e.ascension).tavernesCoupeesAPlein && herosVivants(e) >= 4) {
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
        let gain = soignerAvecGain(e, t);
        let resteKo = n.mortDefinitive && e.persos.some((p) => p.pvActuels <= 0);
        afficherBandeau(
          gain
            ? `🍺 Équipe soignée : +${gain} PV`
            : resteKo
              ? `🍺 Les héros debout étaient déjà en pleine forme`
              : `🍺 L'équipe était déjà en pleine forme`,
        );
      } else {
        recruter(e, i.classeId, i.remplace);
        e.stats.recrutements = (e.stats.recrutements ?? 0) + 1;
        afficherBandeau(
          `🍺 Recrue ! ${CLASSES[i.classeId].nom} rejoint l'équipe${i.remplace ? ` à la place de ${CLASSES[i.remplace]?.nom ?? i.remplace}` : ``}`,
        );
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
      if ((e.philtres ?? 0) >= CONFIG_ARCHI.philtresMax) {
        afficherBandeau(
          `🧪 Otomaï : tes philtres sont déjà au maximum (${CONFIG_ARCHI.philtresMax}/${CONFIG_ARCHI.philtresMax})`,
        );
        return `continue`;
      }
      e.philtres = (e.philtres ?? 0) + 1;
      afficherBandeau(
        `🧪 Otomaï : philtre ${e.philtres}/${CONFIG_ARCHI.philtresMax}, archimonstres à ${Math.round(chanceArchi(e) * 1000) / 10} %`,
      );
      return `continue`;
    case `donjon`: {
      let { gagne, defiOk } = await jouerCombat(e, n, {
        type: `donjon`,
        zone,
      });
      if (!gagne) {
        return `wipe`;
      }
      // l'idole de la zone s'applique aussi au donjon, comme aux combats normaux
      let idoleDonjon = idoleActive(e, o);
      let bonusDefi = defiOk ? 1 + BONUS_DEFI : 1;
      let kamas = distribuerKamas(e, `donjon`, o ? numeroZone(o) : 1, idoleDonjon?.kamasMult ?? 1);
      if (defiOk) {
        kamas += distribuerKamas(
          e,
          `combat_dur`,
          o ? numeroZone(o) : 1,
          idoleDonjon?.kamasMult ?? 1,
        );
      }
      let { xp, niveaux } = gagnerXpEquipe(
        e,
        Math.round(
          calculerXpCombat(XP_PAR_COMBAT.donjon, o ? numeroZone(o) : 1, e.trancheId) *
            bonusDefi *
            (idoleDonjon?.xpMult ?? 1),
        ),
      );
      await distribuerButin(
        e,
        o,
        type,
        undefined,
        texteBilan({ xp, kamas, defiOk, niveaux, libelleDefi: `défi réussi` }),
      );
      await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
      return `victoire`;
    }
    case `rencontre`:
      await jouerRencontre(e, zone);
      await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
      return `continue`;
    default:
      return `continue`;
  }
}
export async function resoudreZaap(pools, t) {
  let n = tirerTypeZaap(Math.random, t);
  afficherBandeau(`🌀 Le zaap mène à : ${ARTICLES_NOEUDS[n]}`);
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
