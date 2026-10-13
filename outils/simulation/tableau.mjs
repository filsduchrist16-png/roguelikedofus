// Tableau des victoires du robot par monde et par difficulté, en lançant une simulation par palier
// en parallèle (un processus par palier, au plus un par cœur).
// usage : npm run sim:tableau -- [mondes=t1,t3,t5] [N=30] [paliers=0,1,2,3,4]
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2).filter((a) => a !== "--");
const mondes = args[0] ?? "t1,t3,t5";
const N = args[1] ?? "30";
const paliers = (args[2] ?? "0,1,2,3,4").split(",").map(Number);
const NOMS = [`Normal`, `Difficile`, `Extrême`, `Cauchemar`, `Ultime`];
const dossier = mkdtempSync(join(tmpdir(), `sim-tableau-`));
const simrun = new URL("./simrun.mjs", import.meta.url).pathname;

function lancer(palier) {
  return new Promise((resolve, reject) => {
    const sortie = join(dossier, `asc${palier}.json`);
    const p = spawn(`npx`, [`vite-node`, simrun, `--`, mondes, N, String(palier), sortie], {
      stdio: [`ignore`, `ignore`, `inherit`],
    });
    p.on(`exit`, (code) =>
      code === 0 ? resolve(JSON.parse(readFileSync(sortie, `utf8`))) : reject(code),
    );
  });
}

const resultats = {};
const file = [...paliers];
const parallele = Math.max(1, Math.min(cpus().length, file.length));
await Promise.all(
  Array.from({ length: parallele }, async () => {
    while (file.length) {
      const palier = file.shift();
      resultats[palier] = await lancer(palier);
      console.error(`palier ${palier} terminé`);
    }
  }),
);
const listeMondes = mondes.split(`,`);
console.log(`| Difficulté | ${listeMondes.join(` | `)} |`);
console.log(`|---|${listeMondes.map(() => `---`).join(`|`)}|`);
for (const palier of paliers) {
  const cases = listeMondes.map((m) => {
    const r = resultats[palier][m];
    return `${Math.round(r.victoires * 100)} % (zone ${r.zoneMoy.toFixed(1)})`;
  });
  console.log(`| ${NOMS[palier] ?? palier} | ${cases.join(` | `)} |`);
}
