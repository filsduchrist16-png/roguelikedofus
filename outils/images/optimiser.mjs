// Optimise les PNG de public/assets SANS changer les noms ni le format (le code référence des .png).
//   - redimensionne au plus à ~2x la taille affichée (plafonds par dossier ci-dessous) ;
//   - ré-encode en PNG (palette 8 bits quand la perte est invisible, sinon PNG complet compressé à fond).
// Rejouable : une image déjà petite n'est jamais agrandie, et on ne remplace un fichier que s'il rétrécit.
// Prérequis (hors dépendances du projet) : npm i --no-save sharp
// Usage : node outils/images/optimiser.mjs [--essai] [dossier-relatif ...]
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const sharp = (await import(`sharp`)).default;
const RACINE = join(fileURLToPath(import.meta.url), `..`, `..`, `..`, `public`, `assets`);

// Plus grand côté autorisé, par dossier (affichage max mesuré × 2 pour les écrans Retina).
const PLAFONDS = {
  classes: 640,
  menu: 640,
  divers: 800,
  fonds: 1600,
  monstres: 256,
  items: 256,
  spells: 256,
  reliques: 256,
  dofus: 256,
  cases: 320,
  elements: 128,
  class_symbol: 256,
};
const PLAFOND_DEFAUT = 1024;
// Palette 8 bits : (255 couleurs) — utilisée seulement si elle fait gagner au moins 25 % et reste très fidèle.
const QUALITE_PALETTE = 95;

const args = process.argv.slice(2);
const essai = args.includes(`--essai`);
const filtres = args.filter((a) => !a.startsWith(`--`));

async function* fichiers(dossier) {
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) yield* fichiers(chemin);
    else if (e.name.toLowerCase().endsWith(`.png`)) yield chemin;
  }
}

let avant = 0;
let apres = 0;
let modifies = 0;
for await (const chemin of fichiers(RACINE)) {
  const rel = relative(RACINE, chemin).split(sep).join(`/`);
  if (filtres.length && !filtres.some((f) => rel.startsWith(f))) continue;
  const tailleAvant = (await stat(chemin)).size;
  avant += tailleAvant;
  const source = await readFile(chemin);
  const plafond = PLAFONDS[rel.split(`/`)[0]] ?? PLAFOND_DEFAUT;
  const base = sharp(source).rotate();
  const meta = await base.metadata();
  const redim = Math.max(meta.width, meta.height) > plafond;
  const prepare = () =>
    redim
      ? sharp(source).resize({
          width: plafond,
          height: plafond,
          fit: `inside`,
          withoutEnlargement: true,
          kernel: `lanczos3`,
        })
      : sharp(source);
  const complet = await prepare()
    .png({ compressionLevel: 9, effort: 10, adaptiveFiltering: true })
    .toBuffer();
  const palette = await prepare()
    .png({ palette: true, quality: QUALITE_PALETTE, effort: 10, colours: 256, dither: 0.6 })
    .toBuffer();
  let choix = palette.length < complet.length * 0.75 ? palette : complet;
  if (choix.length >= tailleAvant) choix = null;
  if (choix && !essai) {
    await writeFile(chemin, choix);
    modifies++;
  }
  apres += choix ? choix.length : tailleAvant;
}
const mo = (n) => (n / 1048576).toFixed(2);
console.log(
  `${essai ? `[essai] ` : ``}${modifies} fichier(s) réécrits · ${mo(avant)} Mo → ${mo(apres)} Mo`,
);
