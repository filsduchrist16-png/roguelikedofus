// Entrée de la version claude.ai : charge les paquets d'images, puis lance le jeu.
const app = document.getElementById(`app`);
app.innerHTML = `<div class="chargement"><p>Chargement de Roguefus Lite…</p><progress max="1" value="0"></progress></div>`;
const barre = app.querySelector(`progress`);

function enBlob(dataUri) {
  const [tete, b64] = dataUri.split(`,`);
  const type = tete.slice(5, tete.indexOf(`;`));
  const octets = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([octets], { type }));
}

async function demarrer() {
  const index = await (await fetch(`paquets/index.json`)).json();
  const assets = {};
  let faits = 0;
  await Promise.all(
    index.paquets.map(async (fichier) => {
      const paquet = await (await fetch(`paquets/${fichier}`)).json();
      for (const [chemin, data] of Object.entries(paquet)) assets[chemin] = enBlob(data);
      barre.value = ++faits / index.paquets.length;
    }),
  );
  globalThis.__ASSETS = assets;
  app.innerHTML = ``;
  await import(`./main.js`);
}

demarrer().catch((e) => {
  app.innerHTML = `<div class="chargement"><p>Le jeu n'a pas pu se charger : ${String(e.message ?? e)}</p></div>`;
});
