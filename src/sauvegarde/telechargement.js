// Proposer un fichier à enregistrer. Sur claude.ai, la page est isolée : un lien <a download> n'y
// fait rien, il faut passer par la capacité « downloads » de l'artefact (le joueur confirme). Ailleurs,
// on garde le lien classique.

let capacite;
function capaciteDownloads() {
  if (capacite === undefined) {
    const use = globalThis.claude?.use;
    capacite =
      typeof use === `function` ? use(`downloads`).catch(() => null) : Promise.resolve(null);
  }
  return capacite;
}

/**
 * @returns {Promise<"saved" | "declined" | "indisponible">}
 */
export async function telechargerTexte(nomFichier, texte) {
  const dl = await capaciteDownloads();
  if (dl) {
    try {
      await dl.save({ filename: nomFichier, data: texte });
      return `saved`;
    } catch (err) {
      if (err?.code === `declined` || err?.code === `rate_limited`) {
        return `declined`;
      }
      return `indisponible`;
    }
  }
  if (globalThis.claude?.use) {
    // sur claude.ai sans la capacité : le lien serait bloqué
    return `indisponible`;
  }
  const url = URL.createObjectURL(new Blob([texte], { type: `application/json` }));
  const lien = document.createElement(`a`);
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return `saved`;
}
