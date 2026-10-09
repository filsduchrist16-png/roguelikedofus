// Rangée compacte de l'équipe (symbole, nom, PV et jauge) pour la taverne et les rencontres.
import { CLASSES } from "../data/index.js";
import { pvMaxPerso } from "../jeu/run.js";
import { echapperHtml, htmlKamas, imgSymboleClasse } from "./commun.js";

export function htmlBarreEquipe(persos, kamas) {
  const heros = persos
    .map((p) => {
      const max = pvMaxPerso(p);
      const pv = Math.max(0, Math.round(p.pvActuels));
      const pct = Math.max(0, Math.min(100, Math.round((pv / max) * 100)));
      const ko = p.pvActuels <= 0;
      const nom = CLASSES[p.classeId]?.nom ?? p.classeId;
      return `<div class="be-heros${ko ? ` ko` : ``}" title="${echapperHtml(nom)} : ${pv} / ${max} PV">
        <img class="be-sym" src="${imgSymboleClasse(p.classeId)}" alt="" onerror="this.remove()" />
        <span class="be-info">
          <span class="be-nom">${echapperHtml(nom)}${ko ? ` <span class="be-ko">K.O.</span>` : ` <small>Niv. ${p.progression.niveau}</small>`}</span>
          <span class="be-pv">PV ${pv}/${max}</span>
          <span class="be-jauge"><span style="width:${pct}%"></span></span>
        </span>
      </div>`;
    })
    .join(``);
  return `<div class="barre-equipe">${heros}${kamas !== undefined ? `<span class="be-kamas">${htmlKamas(kamas)}</span>` : ``}</div>`;
}
