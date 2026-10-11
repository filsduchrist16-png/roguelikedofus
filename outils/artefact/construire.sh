#!/usr/bin/env bash
# Construit la version claude.ai (artefact) dans dist-artefact/ à partir du dernier commit :
#   dist-artefact/roguefus-lite.html   page à publier (file_path)
#   dist-artefact/assets/*             JS/CSS (noms avec empreinte, changent à chaque build)
#   dist-artefact/paquets/*.json       images en WebP regroupées (data URI)
# Les images sont chargées depuis les paquets (globalThis.__ASSETS) au lieu de /assets/.
# Prérequis : npm install fait, python3 avec Pillow. Commiter AVANT de construire (git archive HEAD).
set -euo pipefail
RACINE=$(cd "$(dirname "$0")/../.." && pwd)
OUTILS=$RACINE/outils/artefact
OUT=$RACINE/dist-artefact
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

git -C "$RACINE" archive HEAD src | tar -x -C "$TMP"
cp "$OUTILS/entree-artifact.js" "$TMP/src/"
cp "$OUTILS/index.html" "$OUTILS/vite.config.js" "$TMP/"
ln -s "$RACINE/node_modules" "$TMP/node_modules"

# cheminAsset : chemin relatif → blob chargé depuis les paquets
python3 - "$TMP/src/ui/commun.js" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
old = 'export const cheminAsset = (e) => `/` + e.replace(/^\\/+/, ``);'
assert old in s, "cheminAsset introuvable dans src/ui/commun.js : adapter outils/artefact/construire.sh"
s = s.replace(old, '''export const cheminAsset = (e) => {
  const chemin = e.replace(/^\\/+/, ``);
  return globalThis.__ASSETS?.[chemin] ?? chemin;
};''')
open(p, "w").write(s)
PY

rm -rf "$OUT"
(cd "$TMP" && npx vite build --outDir "$OUT" --emptyOutDir 2>&1 | grep -E "built|error" || true)
rm -f "$OUT/index.html"
python3 "$OUTILS/paquets.py" "$RACINE/public/assets" "$OUT/paquets"

JS=$(cd "$OUT/assets" && ls index-*.js)
cat > "$OUT/roguefus-lite.html" <<HTML
<title>Roguefus Lite</title>
<style>
  body { background: #e6d6b0; }
  .chargement { min-height: 60vh; display: grid; place-content: center; gap: 12px; text-align: center; font-family: system-ui, sans-serif; color: #3a2c1a; }
  .chargement progress { width: min(280px, 70vw); }
</style>
<div id="app"></div>
<script type="module" src="./assets/$JS"></script>
HTML
echo "== construit dans $OUT"
ls "$OUT/assets" "$OUT/paquets"
