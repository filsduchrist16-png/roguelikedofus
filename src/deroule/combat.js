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

export const controleurEnnemi = async (e, t) => {
  // l'action est choisie d'abord : pas d'attente inutile quand le monstre n'a plus rien à faire
  const action = choisirActionIA(e, t);
  if (action) {
    await attendre(parametres.combatRapide ? 180 : 550);
  }
  return action;
};
export async function jouerCombat(e, combatId, n) {
  let r = COMBATS[combatId]?.nom ?? `Combat`;
  let affixes = [];
  let i = combattantsEquipe(e);
  let a = n.type === `secret` ? monstresSecrets(e.trancheId, n.zone) : monstresDuCombat(combatId);
  appliquerDifficulteMonstres(a, effetsDifficulte(e.ascension), {
    type: n.type,
    especesZone: n.zone ? especesNormalesZone(n.zone) : undefined,
    rng: Math.random,
  });
  // après le renfort d'ascension, pour qu'il soit aussi à la puissance de la zone
  appliquerPuissanceZone(a, n.zone?.id, n.type);
  if (n.elite) {
    // affixes en pastilles sous le titre (le titre reste court)
    affixes = appliquerAffixesElite(a, Math.random, n.eliteModifs).map((x) => ({
      nom: x.nom,
      desc: x.desc,
    }));
  }
  // idole de la zone et avis de recherche (rencontres)
  let idole = idoleActive(e, n.zone?.id);
  let traque = n.type === `donjon` || n.type === `secret` ? null : traqueActive(e, n.zone?.id);
  // la traque ne se déclenche que sur un combat qui peut contenir un archimonstre (ou pour la prime)
  if (traque?.archi && !a.some((m) => m.archiNom)) {
    traque = null;
  }
  let pvMult = (idole?.pvMult ?? 1) * (traque ? 1.2 : 1);
  if (pvMult !== 1) {
    for (let m of a) {
      m.pvBase = m.pvMax = m.pvActuels = Math.round(m.pvMax * pvMult);
    }
  }
  const captures = new Set(meta.archis);
  let nouvelArchi = tirerArchis(
    a,
    Math.random,
    chanceArchi(e),
    captures,
    chanceArchiNouveau(e, meta.jaugeArchi),
  );
  let prime = false;
  if (traque) {
    // la traque vise d'abord une espèce encore jamais capturée
    let libres = a.filter((m) => m.archiNom && !m.archi);
    let candidats = libres.filter((m) => !captures.has(m.monstreId));
    if (!candidats.length) {
      candidats = libres;
    }
    if (!traque.archi) {
      prime = true;
      e.traque = null;
    } else if (a.some((m) => m.archi) || candidats.length) {
      if (!a.some((m) => m.archi)) {
        const cible = candidats[Math.floor(Math.random() * candidats.length)];
        tirerArchis([cible], () => 0, 1);
        nouvelArchi ||= !captures.has(cible.monstreId);
      }
      r = `${r} · 📜 Traque`;
      e.traque = null;
    }
  }
  // jauge de traque : seuls les combats qui pouvaient contenir un archi inédit la font monter
  if (nouvelArchi) {
    meta.jaugeArchi = 0;
  } else if (a.some((m) => m.archiNom && !captures.has(m.monstreId))) {
    meta.jaugeArchi = (meta.jaugeArchi ?? 0) + 1;
  }
  let o = tirerMonstreRare(a, Math.random, {
    type: n.type,
    tranche: e.trancheId,
  });
  if (o) {
    r = `${r} · ⭐ ${o}`;
  }
  let s = bonusEquipeRun(meta, e);
  appliquerBonusDofus(i, s);
  let c = [...i, ...a];
  initialiserVueCombat(c, r, meta, {
    playerDamageBonus: s.damageMult,
    enemyDamageBonus: (effetsDifficulte(e.ascension).degatsMult ?? 1) * (idole?.degatsMult ?? 1),
    reliquesActives: dofusPossedes(meta),
    affixes,
  });
  afficherObjectifsCombat(
    objectifsDuCombat({
      quetes: quetesMeta(),
      combattants: c,
      combatId,
      noeud: n.type,
      zoneId: n.zone?.id,
      classes: e.persos.map((e) => e.classeId),
      elements: [...new Set(e.persos.flatMap((p) => CLASSES[p.classeId]?.elements ?? []))],
      soigneurs: i.some((h) => h.sorts.some((id) => SORTS[id]?.type === `soin`)),
      ascension: e.ascension,
      archis: meta.archis,
      reliques: meta.reliques ?? [],
      chanceRelique: chanceRelique(e.ascension, prospectionMoyenne(e, s.prospection)),
      dernierDonjon: n.type === `donjon` && getMonde(e.trancheId).zones.at(-1) === n.zone?.id,
      runSiVictoire: contexteRun(e, e.trancheId, true),
    }),
    { replierApres: parametres.combatRapide ? 5000 : 9000 },
  );
  let defi = tirerDefi(
    Math.random,
    a.map((m) => ({ ref: m.ref, nom: m.nom, boss: !!MONSTRES[m.monstreId]?.boss })),
    i,
  );
  definirDefiCombat(defi);
  let l = nouveauSuiviCombat();
  let herosVivantsAuDepart = i.filter((e) => e.pvActuels > 0).map((e) => e.ref);
  // le suivi ne compte comme « tombés » que les héros debout au départ (défi Survivant, objectifs)
  l.herosDepart = herosVivantsAuDepart;
  let gagne = await executerCombat(c, {
    onEvenement: (ev) => {
      suivreEvenement(l, ev, c);
      majEtatDefi(etatDefi(defi, l, c));
      majObjectifsCombat(l, c);
    },
    controllers: {
      // les créatures et tourelles invoquées par les héros jouent seules
      joueur: (c, cs) => (c.creature ? controleurEnnemi(c, cs) : controleurJoueur(c, cs)),
      ennemi: controleurEnnemi,
    },
    log: journaliser,
    fx: enregistrerFx,
    onDegats: (t, n) => {
      if (t.startsWith(`j_`)) {
        let r = t.slice(2);
        e.stats.degats[r] = (e.stats.degats[r] ?? 0) + n;
      }
    },
    onUpdate: async () => {
      rafraichirCombat();
      await attendre(parametres.combatRapide ? 20 : 60);
    },
    playerDamageBonus: s.damageMult,
    enemyDamageBonus: (effetsDifficulte(e.ascension).degatsMult ?? 1) * (idole?.degatsMult ?? 1),
    reliquesActives: dofusPossedes(meta),
  });
  retirerObjectifsCombat();
  synchroniserPv(e, c);
  let resume = resumeCombat(l, {
    combattants: c,
    herosVivantsAuDepart,
    gagne,
    combatId,
    noeud: n.type,
    zoneId: n.zone?.id,
    classes: e.persos.map((e) => e.classeId),
    ascension: e.ascension,
  });
  let defiOk = defiReussi(defi, {
    ...resume,
    ordreMorts: [...l.morts].filter((ref) => a.some((m) => m.ref === ref)),
  });
  await afficherFinCombat(
    gagne,
    gagne
      ? defiOk
        ? `🎯 Défi ${defi.nom} réussi : +${Math.round(BONUS_DEFI * 100)} % ${e.persos.some((p) => peutGagnerXp(p, e.trancheId)) ? `d'XP et de kamas` : `de kamas`}`
        : `Défi ${defi.nom} raté`
      : ``,
  );
  if (
    gagne &&
    ((e.stats.combats += 1),
    noterEnnemisVaincus(e.stats, a.length),
    (e.stats.archis += await capturerArchis(c)),
    n.type === `donjon`)
  ) {
    let t = tirerReliques(
      meta,
      c
        .filter(
          (e) =>
            e.camp === `ennemi` && e.monstreId && MONSTRES[e.monstreId]?.boss && e.pvActuels <= 0,
        )
        .map((e) => e.monstreId),
      e.ascension,
      prospectionMoyenne(e, s.prospection + (idole?.prospection ?? 0)),
      Math.random,
    );
    if (t.length) {
      sauverMeta(meta);
      e.stats.reliques.push(...t);
      await ecranReliques(t);
    }
  }
  if (gagne) {
    e.stats.defis = (e.stats.defis ?? 0) + (defiOk ? 1 : 0);
  }
  await traiterQuetes(e, verifierQuetesCombat(quetesMeta(), resume));
  await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
  return {
    gagne,
    combatants: c,
    defiOk,
    prime,
  };
}
