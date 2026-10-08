// IA « joueur raisonnable » pour la simulation : essaie chaque sort sur chaque cible valide dans une
// copie du combat, et garde l'action qui rapporte le plus par PA (dégâts, achèvements, soins,
// boucliers ; un buff ou une invocation vaut une bonne action la première fois).
const R = new URL("../../src", import.meta.url).pathname;
const { SORTS } = await import(`${R}/data/index.js`);
const { ciblesValides, coutPA } = await import(`${R}/combat/stats.js`);
const { lancerSort } = await import(`${R}/combat/sorts.js`);
const { peutInvoquer } = await import(`${R}/combat/effets.js`);

const rngFixe = () => 0.5;
const ctxSim = (ctx) => ({
  rng: rngFixe,
  log: () => {},
  playerDamageBonus: ctx.playerDamageBonus,
  enemyDamageBonus: ctx.enemyDamageBonus,
  reliquesActives: ctx.reliquesActives,
  tourDeRef: ctx.tourDeRef,
});

function valeur(avant, apres, camp) {
  let v = 0;
  for (let k = 0; k < avant.length; k++) {
    const a = avant[k];
    const b = apres.find((x) => x.ref === a.ref);
    if (!b) continue;
    const pvA = Math.max(0, a.pvActuels);
    const pvB = Math.max(0, b.pvActuels);
    const bouclier = (b.bouclier ?? 0) - (a.bouclier ?? 0);
    if (a.camp !== camp) {
      v += pvA - pvB;
      if (pvA > 0 && pvB <= 0) v += 0.6 * a.pvMax + 10;
    } else {
      // soins utiles (PV manquants) et boucliers ; perdre un allié est très mauvais
      v += Math.max(0, pvB - pvA) * (pvA < a.pvMax * 0.6 ? 1.2 : 0.4);
      v += Math.max(0, bouclier) * 0.6;
      v -= Math.max(0, pvA - pvB) * 1.2;
      if (pvA > 0 && pvB <= 0) v -= a.pvMax;
    }
  }
  return v;
}

// toutes les actions possibles depuis l'état `cs` pour le combattant `ref`
function actions(cs, ref) {
  const c = cs.find((x) => x.ref === ref);
  if (!c || c.pvActuels <= 0) return [];
  const sorts = c.sorts.map((id) => SORTS[id]).filter(Boolean);
  if (c.armeSort) sorts.push(c.armeSort);
  const out = [];
  for (const s of sorts) {
    const cout = coutPA(s, c);
    if (c.paActuels < cout) continue;
    let cibles;
    try {
      cibles = ciblesValides(c, s, cs);
      if (s.type === "invocation" && !peutInvoquer(c, s, cs)) continue;
    } catch {
      continue;
    }
    for (const cible of cibles) out.push({ s, cibleRef: cible.ref, cout });
  }
  return out;
}
function jouer(cs, ref, a, ctx) {
  const copie = structuredClone(cs);
  const moi = copie.find((x) => x.ref === ref);
  moi.paActuels -= a.cout;
  try {
    lancerSort(moi, a.s, a.cibleRef, copie, ctx);
  } catch {
    return null;
  }
  return copie;
}

export function creerIaPlus(ctxRef) {
  return (c, cs) => {
    const ctx = ctxSim(ctxRef);
    const premiers = [];
    for (const a of actions(cs, c.ref)) {
      const apres = jouer(cs, c.ref, a, ctx);
      if (!apres) continue;
      let v = valeur(cs, apres, c.camp) + (apres.length > cs.length ? 25 : 0);
      premiers.push({ a, apres, v });
    }
    if (!premiers.length) return null;
    // profondeur 2 : la meilleure suite possible avec les PA restants (valorise buffs et combos)
    premiers.sort((x, y) => y.v - x.v);
    const examines = [
      ...premiers.slice(0, 5),
      ...premiers.slice(5).filter((p) => p.a.s.type !== "degats"),
    ];
    for (const p of examines) {
      let suite = 0;
      for (const b of actions(p.apres, c.ref)) {
        const apres2 = jouer(p.apres, c.ref, b, ctx);
        if (apres2) suite = Math.max(suite, valeur(p.apres, apres2, c.camp));
      }
      // un buff dure souvent plusieurs tours : son effet sur la suite compte un peu plus
      const dure = p.a.s.type === "buff" || p.a.s.type === "debuff" ? 1.4 : 1;
      p.total = p.v + suite * dure;
    }
    examines.sort((x, y) => y.total - x.total);
    const best = examines[0];
    if (best.total <= 0) return null;
    return { sort: best.a.s, cibleRef: best.a.cibleRef };
  };
}
