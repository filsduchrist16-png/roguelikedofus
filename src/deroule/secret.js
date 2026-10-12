import {
  secretDuMonde,
  recompensesSecret,
  nomCle,
  tirerIdsButinSecret,
  tirerRareteSecret,
} from "../jeu/secret.js";
import { numeroZone, ajouterKamas } from "../jeu/economie.js";
import { getMonde, calculerXpCombat } from "../jeu/config.js";
import { ecranRencontre } from "../ui/ecrans/rencontre.js";
import { MONSTRES } from "../data/index.js";
import { jouerCombat } from "./combat.js";
import { effetsDifficulte, multiplicateurKamas, tirerObjet } from "../jeu/run.js";
import { ecranMessage } from "../ui/ecrans/message.js";
import { idoleActive, bonusEquipeRun } from "../jeu/rencontres.js";
import { meta, quetesMeta, ctxMeta } from "./etat.js";
import { gagnerXpEquipe } from "./recompenses.js";
import { texteBilan } from "../ui/finCombat.js";
import { enregistrerCollection, sauverMeta } from "../sauvegarde/meta.js";
import { noterObjetsObtenus } from "../ui/ecrans/recap.js";
import { ecranButin } from "../ui/ecrans/butin.js";
import { afficherBandeau } from "../ui/ecrans/succes.js";
import { traiterQuetes } from "./quetes.js";
import { verifierQuetesMeta } from "../jeu/quetes.js";

// ---------- Donjon secret (ouvert avec une clé, après le boss d'une zone) ----------
export async function jouerDonjonSecret(e, zone) {
  let secret = secretDuMonde(e.trancheId);
  if (!e.cle || !secret) {
    return;
  }
  let toile = numeroZone(zone.id);
  let r = recompensesSecret(toile);
  let derniere = getMonde(e.trancheId).zones.at(-1) === zone.id;
  let choix = await ecranRencontre({
    equipe: e.persos,
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
  // l'idole de la zone s'applique aussi au donjon secret
  let idoleSecret = idoleActive(e, zone.id);
  let kamas = Math.round(
    r.kamas *
      multiplicateurKamas(e) *
      bonusEquipeRun(meta, e).multKamas *
      (idoleSecret?.kamasMult ?? 1),
  );
  ajouterKamas(e, kamas);
  let { xp, niveaux } = gagnerXpEquipe(
    e,
    Math.round(calculerXpCombat(r.xp, toile, e.trancheId) * (idoleSecret?.xpMult ?? 1)),
  );
  let bilan = texteBilan({ xp, kamas, niveaux });
  let objets = tirerIdsButinSecret(secret, Math.random)
    .map((id) => tirerObjet(id, Math.random, [tirerRareteSecret(Math.random)]))
    .filter(Boolean);
  if (objets.length) {
    e.inventaire.push(...objets);
    enregistrerCollection(meta, objets);
    e.stats.objets += objets.length;
    noterObjetsObtenus(e.stats, objets);
    await ecranButin(objets, e, bilan);
  } else {
    afficherBandeau(`Victoire : ${bilan}`);
  }
  meta.secrets = [...new Set([...(meta.secrets ?? []), e.trancheId])];
  sauverMeta(meta);
  await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
}
