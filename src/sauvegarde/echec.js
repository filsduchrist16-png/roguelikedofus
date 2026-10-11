// Une sauvegarde qui échoue (navigateur plein, mode privé strict) ne doit pas passer inaperçue :
// on prévient une seule fois par session, par un évènement que main.js transforme en bandeau.
let deja = false;
export function signalerEchecSauvegarde() {
  if (deja) {
    return;
  }
  deja = true;
  try {
    globalThis.dispatchEvent?.(new CustomEvent(`rld-sauvegarde-echec`));
  } catch {}
}
