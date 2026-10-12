import { choisirActionIA } from "../combat/ia.js";
import { attendre, meta, quetesMeta, ctxMeta } from "./etat.js";
import { parametres } from "../ui/commun.js";
import { COMBATS, CLASSES, SORTS, MONSTRES } from "../data/index.js";
import {
  combattantsEquipe,
  monstresDuCombat,
  appliquerDifficulteMonstres,
  effetsDifficulte,
  especesNormalesZone,
  appliquerPuissanceZone,
  appliquerAffixesElite,
  tirerArchis,
  chanceArchi,
  chanceArchiNouveau,
  tirerMonstreRare,
  synchroniserPv,
  peutGagnerXp,
} from "../jeu/run.js";
import { monstresSecrets } from "../jeu/secret.js";
import { idoleActive, traqueActive, bonusEquipeRun } from "../jeu/rencontres.js";
import {
  appliquerBonusDofus,
  dofusPossedes,
  chanceRelique,
  prospectionMoyenne,
  tirerReliques,
  sauverMeta,
} from "../sauvegarde/meta.js";
import {
  initialiserVueCombat,
  definirDefiCombat,
  majEtatDefi,
  controleurJoueur,
  journaliser,
  enregistrerFx,
  rafraichirCombat,
} from "../ui/combat.js";
import {
  afficherObjectifsCombat,
  majObjectifsCombat,
  retirerObjectifsCombat,
} from "../ui/objectifs.js";
import { objectifsDuCombat } from "../jeu/objectifs.js";
import { getMonde } from "../jeu/config.js";
import { contexteRun, traiterQuetes } from "./quetes.js";
import { tirerDefi, etatDefi, defiReussi, BONUS_DEFI } from "../jeu/defis.js";
import { nouveauSuiviCombat, suivreEvenement, resumeCombat } from "../jeu/suiviCombat.js";
import { executerCombat } from "../combat/moteur.js";
import { afficherFinCombat } from "../ui/finCombat.js";
import { noterEnnemisVaincus } from "../ui/ecrans/recap.js";
import { capturerArchis } from "./recompenses.js";
import { ecranReliques } from "../ui/ecrans/recompenses.js";
import { verifierQuetesCombat, verifierQuetesMeta } from "../jeu/quetes.js";

export const controleurEnnemi = async (acteur, combattants) => {
  // l'action est choisie d'abord : pas d'attente inutile quand le monstre n'a plus rien à faire
  const action = choisirActionIA(acteur, combattants);
  if (action) {
    await attendre(parametres.combatRapide ? 180 : 550);
  }
  return action;
};
export async function jouerCombat(run, combatId, contexte) {
  let titre = COMBATS[combatId]?.nom ?? `Combat`;
  let affixes = [];
  let equipe = combattantsEquipe(run);
  let monstres =
    contexte.type === `secret`
      ? monstresSecrets(run.trancheId, contexte.zone)
      : monstresDuCombat(combatId);
  appliquerDifficulteMonstres(monstres, effetsDifficulte(run.ascension), {
    type: contexte.type,
    especesZone: contexte.zone ? especesNormalesZone(contexte.zone) : undefined,
    rng: Math.random,
  });
  // après le renfort d'ascension, pour qu'il soit aussi à la puissance de la zone
  appliquerPuissanceZone(monstres, contexte.zone?.id, contexte.type);
  if (contexte.elite) {
    // affixes en pastilles sous le titre (le titre reste court)
    affixes = appliquerAffixesElite(monstres, Math.random, contexte.eliteModifs).map((affixe) => ({
      nom: affixe.nom,
      desc: affixe.desc,
    }));
  }
  // idole de la zone et avis de recherche (rencontres)
  let idole = idoleActive(run, contexte.zone?.id);
  let traque =
    contexte.type === `donjon` || contexte.type === `secret`
      ? null
      : traqueActive(run, contexte.zone?.id);
  // la traque ne se déclenche que sur un combat qui peut contenir un archimonstre (ou pour la prime)
  if (traque?.archi && !monstres.some((monstre) => monstre.archiNom)) {
    traque = null;
  }
  let pvMult = (idole?.pvMult ?? 1) * (traque ? 1.2 : 1);
  if (pvMult !== 1) {
    for (let monstre of monstres) {
      monstre.pvBase = monstre.pvMax = monstre.pvActuels = Math.round(monstre.pvMax * pvMult);
    }
  }
  const captures = new Set(meta.archis);
  let nouvelArchi = tirerArchis(
    monstres,
    Math.random,
    chanceArchi(run),
    captures,
    chanceArchiNouveau(run, meta.jaugeArchi),
  );
  let prime = false;
  if (traque) {
    // la traque vise d'abord une espèce encore jamais capturée
    let libres = monstres.filter((monstre) => monstre.archiNom && !monstre.archi);
    let candidats = libres.filter((monstre) => !captures.has(monstre.monstreId));
    if (!candidats.length) {
      candidats = libres;
    }
    if (!traque.archi) {
      prime = true;
      run.traque = null;
    } else if (monstres.some((monstre) => monstre.archi) || candidats.length) {
      if (!monstres.some((monstre) => monstre.archi)) {
        const cible = candidats[Math.floor(Math.random() * candidats.length)];
        tirerArchis([cible], () => 0, 1);
        nouvelArchi ||= !captures.has(cible.monstreId);
      }
      titre = `${titre} · 📜 Traque`;
      run.traque = null;
    }
  }
  // jauge de traque : seuls les combats qui pouvaient contenir un archi inédit la font monter
  if (nouvelArchi) {
    meta.jaugeArchi = 0;
  } else if (monstres.some((monstre) => monstre.archiNom && !captures.has(monstre.monstreId))) {
    meta.jaugeArchi = (meta.jaugeArchi ?? 0) + 1;
  }
  let monstreRare = tirerMonstreRare(monstres, Math.random, {
    type: contexte.type,
    tranche: run.trancheId,
  });
  if (monstreRare) {
    titre = `${titre} · ⭐ ${monstreRare}`;
  }
  let bonusEquipe = bonusEquipeRun(meta, run);
  appliquerBonusDofus(equipe, bonusEquipe);
  let combattants = [...equipe, ...monstres];
  initialiserVueCombat(combattants, titre, meta, {
    playerDamageBonus: bonusEquipe.damageMult,
    enemyDamageBonus: (effetsDifficulte(run.ascension).degatsMult ?? 1) * (idole?.degatsMult ?? 1),
    reliquesActives: dofusPossedes(meta),
    affixes,
  });
  afficherObjectifsCombat(
    objectifsDuCombat({
      quetes: quetesMeta(),
      combattants,
      combatId,
      noeud: contexte.type,
      zoneId: contexte.zone?.id,
      classes: run.persos.map((perso) => perso.classeId),
      elements: [
        ...new Set(run.persos.flatMap((perso) => CLASSES[perso.classeId]?.elements ?? [])),
      ],
      soigneurs: equipe.some((heros) => heros.sorts.some((id) => SORTS[id]?.type === `soin`)),
      ascension: run.ascension,
      archis: meta.archis,
      reliques: meta.reliques ?? [],
      chanceRelique: chanceRelique(run.ascension, prospectionMoyenne(run, bonusEquipe.prospection)),
      dernierDonjon:
        contexte.type === `donjon` && getMonde(run.trancheId).zones.at(-1) === contexte.zone?.id,
      runSiVictoire: contexteRun(run, run.trancheId, true),
    }),
    { replierApres: parametres.combatRapide ? 5000 : 9000 },
  );
  let defi = tirerDefi(
    Math.random,
    monstres.map((monstre) => ({
      ref: monstre.ref,
      nom: monstre.nom,
      boss: !!MONSTRES[monstre.monstreId]?.boss,
    })),
    equipe,
  );
  definirDefiCombat(defi);
  let suivi = nouveauSuiviCombat();
  let herosVivantsAuDepart = equipe
    .filter((heros) => heros.pvActuels > 0)
    .map((heros) => heros.ref);
  // le suivi ne compte comme « tombés » que les héros debout au départ (défi Survivant, objectifs)
  suivi.herosDepart = herosVivantsAuDepart;
  let gagne = await executerCombat(combattants, {
    onEvenement: (ev) => {
      suivreEvenement(suivi, ev, combattants);
      majEtatDefi(etatDefi(defi, suivi, combattants));
      majObjectifsCombat(suivi, combattants);
    },
    controllers: {
      // les créatures et tourelles invoquées par les héros jouent seules
      joueur: (acteur, tous) =>
        acteur.creature ? controleurEnnemi(acteur, tous) : controleurJoueur(acteur, tous),
      ennemi: controleurEnnemi,
    },
    log: journaliser,
    fx: enregistrerFx,
    onDegats: (refCombattant, montant) => {
      if (refCombattant.startsWith(`j_`)) {
        let classeId = refCombattant.slice(2);
        run.stats.degats[classeId] = (run.stats.degats[classeId] ?? 0) + montant;
      }
    },
    onUpdate: async () => {
      rafraichirCombat();
      await attendre(parametres.combatRapide ? 20 : 60);
    },
    playerDamageBonus: bonusEquipe.damageMult,
    enemyDamageBonus: (effetsDifficulte(run.ascension).degatsMult ?? 1) * (idole?.degatsMult ?? 1),
    reliquesActives: dofusPossedes(meta),
  });
  retirerObjectifsCombat();
  synchroniserPv(run, combattants);
  let resume = resumeCombat(suivi, {
    combattants,
    herosVivantsAuDepart,
    gagne,
    combatId,
    noeud: contexte.type,
    zoneId: contexte.zone?.id,
    classes: run.persos.map((perso) => perso.classeId),
    ascension: run.ascension,
  });
  let defiOk = defiReussi(defi, {
    ...resume,
    ordreMorts: [...suivi.morts].filter((ref) => monstres.some((monstre) => monstre.ref === ref)),
  });
  await afficherFinCombat(
    gagne,
    gagne
      ? defiOk
        ? `🎯 Défi ${defi.nom} réussi : +${Math.round(BONUS_DEFI * 100)} % ${run.persos.some((perso) => peutGagnerXp(perso, run.trancheId)) ? `d'XP et de kamas` : `de kamas`}`
        : `Défi ${defi.nom} raté`
      : ``,
  );
  if (
    gagne &&
    ((run.stats.combats += 1),
    noterEnnemisVaincus(run.stats, monstres.length),
    (run.stats.archis += await capturerArchis(combattants)),
    contexte.type === `donjon`)
  ) {
    let reliques = tirerReliques(
      meta,
      combattants
        .filter(
          (combattant) =>
            combattant.camp === `ennemi` &&
            combattant.monstreId &&
            MONSTRES[combattant.monstreId]?.boss &&
            combattant.pvActuels <= 0,
        )
        .map((combattant) => combattant.monstreId),
      run.ascension,
      prospectionMoyenne(run, bonusEquipe.prospection + (idole?.prospection ?? 0)),
      Math.random,
    );
    if (reliques.length) {
      sauverMeta(meta);
      run.stats.reliques.push(...reliques);
      await ecranReliques(reliques);
    }
  }
  if (gagne) {
    run.stats.defis = (run.stats.defis ?? 0) + (defiOk ? 1 : 0);
  }
  await traiterQuetes(run, verifierQuetesCombat(quetesMeta(), resume));
  await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
  return {
    gagne,
    combatants: combattants,
    defiOk,
    prime,
  };
}
