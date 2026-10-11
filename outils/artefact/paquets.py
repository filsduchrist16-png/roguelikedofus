# Convertit public/assets en WebP et les regroupe en paquets JSON (data URI) d'environ 3 Mo.
import base64, io, json, os, sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
paquets, courant, taille = [], {}, 0
def vider():
    global courant, taille
    if courant:
        nom = f"images-{len(paquets) + 1}.json"
        json.dump(courant, open(f"{out}/{nom}", "w"))
        paquets.append(nom)
    courant, taille = {}, 0
for racine, _, fichiers in sorted(os.walk(src)):
    for f in sorted(fichiers):
        if not f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            continue
        chemin = os.path.join(racine, f)
        cle = "assets/" + os.path.relpath(chemin, src).replace(os.sep, "/")
        im = Image.open(chemin)
        im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") or "transparency" in im.info else im.convert("RGB")
        if max(im.size) > 1600:
            im.thumbnail((1600, 1600))
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=82, method=4)
        data = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
        if taille + len(data) > 3_000_000:
            vider()
        courant[cle] = data
        taille += len(data)
vider()
json.dump({"paquets": paquets}, open(f"{out}/index.json", "w"))
print(len(paquets), "paquets")
