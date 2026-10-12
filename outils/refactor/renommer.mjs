// Renommage automatique, sensible à la portée, des variables d'une lettre
// (héritées d'une version minifiée) et des variables ombrées (ESLint `no-shadow`).
//
// Outils : `acorn` (analyse) + `eslint-scope` (portées) + `magic-string` (réécriture),
// tous trois déjà présents dans node_modules via eslint.
//
// Usage :
//   node outils/refactor/renommer.mjs lister [fichier.js ...]   candidats d'un ou de tous les fichiers
//   node outils/refactor/renommer.mjs appliquer <table.txt>     applique une table de correspondance
//   node outils/refactor/renommer.mjs appliquer <table.txt> --a-blanc   vérifie sans écrire
//
// Une table (outils/refactor/tables/*.txt) porte, après `# fichier: chemin`, une ligne par
// renommage choisi à la main après lecture du code :
//   <ligne>[-<ligne2>] <ancien>[#k] <nouveau>
// - `<ligne>` : ligne de la DÉCLARATION (paramètre, let/const/var, fonction) ;
// - `<ligne>-<ligne2>` : toutes les déclarations de cette lettre dans la plage (la plage la plus
//   étroite l'emporte, puis la ligne seule) ;
// - `#k` : k-ième déclaration de cette lettre sur la ligne (de gauche à droite), si plusieurs.
//
// Garanties : jamais de remplacement textuel. Chaque identifiant renommé est une déclaration ou
// une référence résolue par eslint-scope vers la même variable. Avant d'écrire, on vérifie que
// la résolution de CHAQUE référence du fichier reste identique avec les noms finaux (aucune
// collision, aucune capture, aucun nom réservé). Les propriétés, chaînes, imports, exports et
// `catch` sans usage ne sont jamais touchés ; une propriété raccourcie `{ e }` devient `{ e: nom }`.
import fs from "node:fs";
import path from "node:path";
import * as acorn from "acorn";
import * as eslintScope from "eslint-scope";
import MagicString from "magic-string";

const RESERVES = new Set(
  (
    `break case catch class const continue debugger default delete do else enum export extends false ` +
    `finally for function if import in instanceof new null return super switch this throw true try ` +
    `typeof var void while with yield let static implements interface package private protected ` +
    `public await async of arguments eval undefined NaN Infinity`
  ).split(` `),
);
const NOM_VALIDE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function analyser(source) {
  const ast = acorn.parse(source, { ecmaVersion: `latest`, sourceType: `module`, ranges: true });
  const manager = eslintScope.analyze(ast, { ecmaVersion: 2024, sourceType: `module` });
  return { ast, manager };
}

// Parcours simple de l'arbre : retourne les propriétés raccourcies et les noms exportés.
function inspecter(ast) {
  const raccourcies = new Map(); // début de la clé -> propriété
  const reductibles = new Map(); // début de la valeur -> propriété `cle: valeur` (hors raccourcie)
  const exportes = new Set();
  const visiter = (n) => {
    if (!n || typeof n.type !== `string`) return;
    if (n.type === `Property` && n.shorthand) raccourcies.set(n.key.start, n);
    else if (n.type === `Property` && !n.computed && n.key.type === `Identifier`) {
      const v = n.value.type === `AssignmentPattern` ? n.value.left : n.value;
      if (v.type === `Identifier`) reductibles.set(v.start, n);
    }
    if (n.type === `ExportSpecifier` && n.local) exportes.add(n.local.name);
    if (n.type === `ExportNamedDeclaration` && n.declaration) {
      const d = n.declaration;
      if (d.id) exportes.add(d.id.name);
      for (const v of d.declarations ?? []) collecterNoms(v.id, exportes);
    }
    for (const cle of Object.keys(n)) {
      const v = n[cle];
      if (Array.isArray(v)) v.forEach(visiter);
      else if (v && typeof v.type === `string`) visiter(v);
    }
  };
  visiter(ast);
  return { raccourcies, reductibles, exportes };
}

function collecterNoms(p, ensemble) {
  if (!p) return;
  if (p.type === `Identifier`) ensemble.add(p.name);
  else if (p.type === `ObjectPattern`)
    p.properties.forEach((q) => collecterNoms(q.value ?? q.argument, ensemble));
  else if (p.type === `ArrayPattern`) p.elements.forEach((q) => collecterNoms(q, ensemble));
  else if (p.type === `AssignmentPattern`) collecterNoms(p.left, ensemble);
  else if (p.type === `RestElement`) collecterNoms(p.argument, ensemble);
}

function estModule(scope) {
  return scope.type === `module` || scope.type === `global`;
}

// Variables renommables : toutes celles déclarées dans le fichier (hors imports, noms exportés,
// `arguments` et `catch` sans usage). `candidate` : une lettre, ou ombrant un nom d'une portée
// englobante : ce sont celles que `lister` signale et que l'on veut traiter.
export function variables(manager, exportes) {
  const res = [];
  for (const scope of manager.scopes) {
    if (scope.type === `global`) continue;
    for (const v of scope.variables) {
      if (v.name === `arguments` || v.defs.length === 0) continue;
      const def = v.defs[0];
      if (def.type === `ImportBinding`) continue;
      if (scope.type === `module` && exportes.has(v.name)) continue;
      if (def.type === `CatchClause` && v.references.length === 0) continue;
      let ombre = false;
      for (let s = scope.upper; s; s = s.upper) {
        if (s.set.has(v.name) && s.type !== `global`) {
          ombre = true;
          break;
        }
      }
      res.push({ v, scope, ombre, candidate: v.name.length === 1 || ombre });
    }
  }
  return res;
}
export const candidats = (manager, exportes) =>
  variables(manager, exportes).filter((c) => c.candidate);

function ligneDe(source, pos) {
  let n = 1;
  for (let i = 0; i < pos; i++) if (source.charCodeAt(i) === 10) n++;
  return n;
}

export function lireTable(texte) {
  let fichier = null;
  const regles = [];
  for (const brut of texte.split(`\n`)) {
    const l = brut.trim();
    if (!l) continue;
    const m0 = /^#\s*fichier:\s*(\S+)/.exec(l);
    if (m0) {
      fichier = m0[1];
      continue;
    }
    if (l.startsWith(`#`)) continue;
    const m =
      /^(\d+)(?:-(\d+))?\s+([A-Za-z_$][\w$]*)(?:#(\d+))?\s+([A-Za-z_$][\w$]*)\s*(?:#.*)?$/.exec(l);
    if (!m) throw new Error(`Ligne de table illisible : ${brut}`);
    const debut = Number(m[1]);
    regles.push({
      debut,
      fin: m[2] ? Number(m[2]) : debut,
      ancien: m[3],
      rang: m[4] ? Number(m[4]) : null,
      nouveau: m[5],
      ligneTable: brut,
    });
  }
  return { fichier, regles };
}

export function renommerSource(source, regles) {
  const { ast, manager } = analyser(source);
  const { raccourcies, reductibles, exportes } = inspecter(ast);
  const cands = variables(manager, exportes);

  // numérote les déclarations d'une même lettre sur une même ligne (gauche -> droite)
  const infos = cands.map((c) => {
    const noeud = c.v.defs[0].name;
    return { ...c, noeud, ligne: ligneDe(source, noeud.start) };
  });
  const parLigne = new Map();
  for (const i of infos.sort((a, b) => a.noeud.start - b.noeud.start)) {
    const cle = `${i.ligne}:${i.v.name}`;
    i.rang = (parLigne.get(cle) ?? 0) + 1;
    parLigne.set(cle, i.rang);
  }

  const final = new Map(); // variable -> nouveau nom
  const utilisees = new Set();
  const restants = [];
  for (const i of infos) {
    const bons = regles.filter(
      (r) =>
        r.ancien === i.v.name &&
        r.debut <= i.ligne &&
        i.ligne <= r.fin &&
        (r.rang === null || r.rang === i.rang),
    );
    // la règle la plus précise l'emporte : rang explicite, puis plage la plus étroite
    bons.sort(
      (a, b) => (b.rang !== null) - (a.rang !== null) || a.fin - a.debut - (b.fin - b.debut),
    );
    const r = bons[0];
    if (r) {
      utilisees.add(r);
      if (r.nouveau !== i.v.name) final.set(i.v, r.nouveau);
    } else if (i.candidate) {
      // une ombre disparaît si la variable ombrée a été renommée entre-temps (jugé plus bas)
      restants.push(i);
    }
  }
  const nomApres = (v) => final.get(v) ?? v.name;
  for (let k = restants.length - 1; k >= 0; k--) {
    const i = restants[k];
    if (i.v.name.length === 1) continue;
    let toujoursOmbre = false;
    for (let s = i.scope.upper; s && !toujoursOmbre; s = s.upper) {
      if (s.type === `global`) break;
      toujoursOmbre = s.variables.some((w) => nomApres(w) === i.v.name);
    }
    if (!toujoursOmbre) restants.splice(k, 1);
  }
  const inutilisees = regles.filter((r) => !utilisees.has(r));

  const erreurs = [];
  for (const nom of new Set(final.values())) {
    if (!NOM_VALIDE.test(nom) || RESERVES.has(nom))
      erreurs.push(`nom invalide ou réservé : ${nom}`);
  }
  const nomFinal = (v) => final.get(v) ?? v.name;

  // vérification globale de la résolution avec les noms finaux
  for (const scope of manager.scopes) {
    const vus = new Map();
    for (const v of scope.variables) {
      const n = nomFinal(v);
      if (vus.has(n) && vus.get(n) !== v)
        erreurs.push(
          `collision dans une même portée (ligne ${ligneDe(source, v.identifiers[0]?.start ?? 0)}) : ${n}`,
        );
      vus.set(n, v);
    }
  }
  const cacheNoms = new Map();
  const tableDe = (s) => {
    let t = cacheNoms.get(s);
    if (!t) {
      t = new Map();
      for (const v of s.variables) t.set(nomFinal(v), v);
      cacheNoms.set(s, t);
    }
    return t;
  };
  for (const scope of manager.scopes) {
    for (const r of scope.references) {
      const cible = r.resolved ? nomFinal(r.resolved) : r.identifier.name;
      let trouve = null;
      for (let s = r.from; s; s = s.upper) {
        const v = tableDe(s).get(cible);
        if (v) {
          trouve = v;
          break;
        }
      }
      if ((r.resolved ?? null) !== trouve) {
        erreurs.push(
          `capture/collision ligne ${ligneDe(source, r.identifier.start)} : ${r.identifier.name} -> ${cible}`,
        );
      }
    }
  }
  if (erreurs.length) return { erreurs: [...new Set(erreurs)], inutilisees, restants };

  const ms = new MagicString(source);
  const faits = new Set();
  let nb = 0;
  for (const [v, nouveau] of final) {
    const noeuds = new Map();
    for (const d of v.defs) noeuds.set(d.name.start, d.name);
    for (const r of v.references) noeuds.set(r.identifier.start, r.identifier);
    for (const [debut, n] of noeuds) {
      if (faits.has(debut)) continue;
      faits.add(debut);
      const prop = reductibles.get(debut);
      if (raccourcies.has(debut)) ms.overwrite(n.start, n.end, `${n.name}: ${nouveau}`);
      else if (prop && prop.key.name === nouveau)
        ms.overwrite(prop.key.start, n.end, nouveau); // `a: a` -> `a`
      else ms.overwrite(n.start, n.end, nouveau);
    }
    nb++;
  }
  return { code: ms.toString(), nb, inutilisees, restants, erreurs: [] };
}

function decrire(i, source) {
  const ligne = source.split(`\n`)[i.ligne - 1].trim().slice(0, 90);
  return `${i.ligne}:${i.v.name}${i.rang > 1 ? `#${i.rang}` : ``}${i.ombre && i.v.name.length > 1 ? ` (ombre)` : ``}  | ${ligne}`;
}

function principal() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === `lister`) {
    const detail = args.includes(`-v`);
    const fichiers = args.filter((a) => a !== `-v`);
    const liste = fichiers.length ? fichiers : fs.globSync(`src/**/*.js`).sort();
    let total = 0;
    for (const f of liste) {
      const source = fs.readFileSync(f, `utf8`);
      const { ast, manager } = analyser(source);
      const tous = variables(manager, inspecter(ast).exportes);
      const cs = tous.filter((c) => c.candidate);
      total += cs.length;
      console.log(`${String(cs.length).padStart(5)}  ${f}`);
      if (detail) {
        const infos = tous.map((c) => ({
          ...c,
          noeud: c.v.defs[0].name,
          ligne: ligneDe(source, c.v.defs[0].name.start),
        }));
        infos.sort((a, b) => a.noeud.start - b.noeud.start);
        const rang = new Map();
        for (const i of infos) {
          const cle = `${i.ligne}:${i.v.name}`;
          i.rang = (rang.get(cle) ?? 0) + 1;
          rang.set(cle, i.rang);
          if (i.candidate) console.log(`   ${decrire(i, source)}`);
        }
      }
    }
    console.log(`${String(total).padStart(5)}  total`);
    return;
  }
  if (cmd === `appliquer`) {
    const aBlanc = args.includes(`--a-blanc`);
    const tables = args.filter((a) => !a.startsWith(`--`));
    let code = 0;
    for (const t of tables) {
      const { fichier, regles } = lireTable(fs.readFileSync(t, `utf8`));
      const source = fs.readFileSync(fichier, `utf8`);
      const res = renommerSource(source, regles);
      if (res.erreurs.length) {
        console.error(`${fichier} : REFUSÉ\n  ${res.erreurs.join(`\n  `)}`);
        code = 1;
        continue;
      }
      for (const r of res.inutilisees)
        console.warn(`${fichier} : règle sans effet : ${r.ligneTable.trim()}`);
      if (!aBlanc) fs.writeFileSync(fichier, res.code);
      const analyse = analyser(source);
      void analyse;
      console.log(
        `${fichier} : ${res.nb} variables renommées, ${res.restants.length} candidates restantes`,
      );
      for (const i of res.restants) console.log(`   reste ${decrire(i, source)}`);
    }
    process.exitCode = code;
    return;
  }
  console.error(`Usage : renommer.mjs lister|appliquer ...`);
  process.exitCode = 2;
}

if (path.resolve(process.argv[1] ?? ``) === path.resolve(new URL(import.meta.url).pathname))
  principal();
