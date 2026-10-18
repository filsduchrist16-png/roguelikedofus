// Récapitulatif des effets actifs d'un combattant (1.9.0), ouvert d'un appui sur sa carte ou, sur
// téléphone, sur sa pastille de la barre du bas (où les cartes de l'équipe sont cachées) : PV,
// bouclier, PA, chaque état, poison, soin ou bonus avec sa durée restante, et les résistances.
import { resistanceTotale } from "../combat/stats.js";
import { echapperHtml, NOMS_ELEMENTS } from "./commun.js";

const ELEMENTS = [`terre`, `feu`, `eau`, `air`];

/** Marqueurs courts pour la pastille d'un héros : « 🛡 12 ☠ +2 » (vide sans effet). */
export function marqueursEffets(combattant, badges = []) {
  const parties = [];
  const bouclier = Math.round(combattant.bouclier ?? 0);
  if (bouclier > 0) {
    parties.push(`🛡${bouclier}`);
  }
  const poison = (combattant.effets ?? []).some((effet) => effet.stat === `poison`);
  if (poison) {
    parties.push(`☠`);
  }
  // le poison et le bouclier temporaire ont déjà leur marqueur
  const autres = badges.filter(
    (badge) => !/^☠/.test(badge.texte) && !/^🛡 bouclier/.test(badge.texte),
  ).length;
  if (autres > 0) {
    parties.push(`+${autres}`);
  }
  return parties.join(` `);
}

/** Contenu du récapitulatif (badges : ceux de la carte, avec leur texte long). */
export function htmlRecapEffets(combattant, badges = []) {
  const pv = Math.max(0, Math.round(combattant.pvActuels));
  const bouclier = Math.round(combattant.bouclier ?? 0);
  const resistances = ELEMENTS.map((element) => ({
    element,
    pct: Math.round(resistanceTotale(combattant, element) * 100),
  }));
  const lignes = badges.length
    ? badges
        .map(
          (badge) =>
            `<li class="re-effet${badge.classe ? ` ${badge.classe}` : ``}"><b>${echapperHtml(badge.texte)}</b><span>${echapperHtml(badge.tip ?? ``)}</span></li>`,
        )
        .join(``)
    : `<li class="re-effet re-aucun"><span>Aucun effet actif.</span></li>`;
  return `<div class="re-tete">
      <h3 id="re-titre">${echapperHtml(combattant.nom)}${combattant.pvActuels <= 0 ? ` · K.O.` : ``}</h3>
      <button class="re-fermer" data-fermer-recap aria-label="Fermer">✕</button>
    </div>
    <p class="re-etat">❤ ${pv} / ${combattant.pvMax} PV${bouclier > 0 ? ` · 🛡 ${bouclier} de bouclier (absorbé avant les PV)` : ``} · ★ ${combattant.paActuels} / ${combattant.paMax} PA</p>
    <h4 class="re-sous-titre">Effets actifs</h4>
    <ul class="re-liste">${lignes}</ul>
    <p class="re-res">Résistances : ${resistances
      .map(
        ({ element, pct }) =>
          `<span class="re-res-el${pct < 0 ? ` faible` : pct > 0 ? ` forte` : ``}">${NOMS_ELEMENTS[element]} ${pct > 0 ? `+` : ``}${pct} %</span>`,
      )
      .join(` · `)}</p>`;
}
