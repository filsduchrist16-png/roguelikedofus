// Preuve de non-régression d'un renommage : compare, fichier par fichier, l'arbre syntaxique d'une
// révision de référence et celui du dossier de travail, une fois chaque variable remplacée par un
// numéro (équivalence « à renommage près », alpha-équivalence). Les propriétés, chaînes, nombres,
// commentaires exclus et la structure doivent être strictement identiques.
//
// Usage : node outils/refactor/verifier.mjs <révision> [fichier.js ...]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { analyser } from "./renommer.mjs";

function canonique(source) {
  const { ast, manager } = analyser(source);
  const numero = new Map(); // début de l'identifiant -> numéro de variable
  let n = 0;
  for (const scope of manager.scopes) {
    for (const v of scope.variables) {
      const id = n++;
      for (const d of v.defs) numero.set(d.name.start, id);
      for (const r of v.references) numero.set(r.identifier.start, id);
    }
  }
  const ser = (nd) => {
    if (Array.isArray(nd)) return nd.map(ser);
    if (!nd || typeof nd !== `object`) return nd;
    if (nd.type === `Identifier`) {
      return numero.has(nd.start)
        ? { t: `Id`, v: numero.get(nd.start) }
        : { t: `Id`, nom: nd.name };
    }
    const sortie = {};
    for (const cle of Object.keys(nd).sort()) {
      if (cle === `start` || cle === `end` || cle === `range` || cle === `loc`) continue;
      if (nd.type === `Property` && cle === `shorthand`) continue;
      if (nd.type === `Property` && cle === `key` && !nd.computed && nd.key.type === `Identifier`) {
        sortie.key = { t: `Cle`, nom: nd.key.name };
        continue;
      }
      sortie[cle] = ser(nd[cle]);
    }
    return sortie;
  };
  return JSON.stringify(ser(ast));
}

const [ref, ...fichiers] = process.argv.slice(2);
if (!ref) {
  console.error(`Usage : verifier.mjs <révision> [fichier.js ...]`);
  process.exit(2);
}
const liste = fichiers.length ? fichiers : fs.globSync(`src/**/*.js`).sort();
let ko = 0;
let identiques = 0;
for (const f of liste) {
  let avant;
  try {
    avant = execFileSync(`git`, [`show`, `${ref}:${f}`], {
      encoding: `utf8`,
      maxBuffer: 1 << 26,
      stdio: [`ignore`, `pipe`, `ignore`],
    });
  } catch {
    console.log(`ABSENT dans ${ref} : ${f}`);
    continue;
  }
  const apres = fs.readFileSync(f, `utf8`);
  if (canonique(avant) === canonique(apres)) identiques++;
  else {
    ko++;
    console.log(`DIFFÉRENT : ${f}`);
  }
}
console.log(`${identiques} fichiers équivalents, ${ko} différents`);
process.exit(ko ? 1 : 0);
