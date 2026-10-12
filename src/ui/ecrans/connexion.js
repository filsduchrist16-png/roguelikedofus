import { IMG_LOGO, afficherEcran } from "../commun.js";
import { creerCompte, jouerSansCompte, seConnecter } from "../../sauvegarde/compte.js";
import { VERSION } from "../../version.js";

/** Page de connexion proposée au lancement. Se résout quand le joueur joue sans compte ; après une connexion réussie, la page est rechargée (la partie en ligne est alors reprise). */
export function ecranConnexion() {
  return new Promise((resolve) => {
    afficherEcran(`
      <div class="connexion">
        <img class="logo-accueil" src="${IMG_LOGO}" alt="Roguefus Lite" onerror="this.remove()" />
        <h1 class="sr-only">Roguefus Lite : connexion</h1>
        <p class="sous-titre">Connecte-toi pour retrouver ta partie sur tous tes appareils.</p>
        <form id="cx-form" class="connexion-form" autocomplete="on">
          <input id="cx-email" type="email" autocomplete="username" inputmode="email" placeholder="Email" aria-label="Email" required />
          <input id="cx-mdp" type="password" autocomplete="current-password" placeholder="Mot de passe (6 caractères min.)" aria-label="Mot de passe" minlength="6" required />
          <p id="cx-msg" class="muet" role="status"></p>
          <button id="cx-entrer" type="submit" class="primaire">Se connecter</button>
          <button id="cx-creer" type="button" class="secondaire">Créer un compte</button>
        </form>
        <button id="cx-sans" class="btn-lien">Jouer sans compte (sauvegarde sur cet appareil seulement)</button>
        <p class="connexion-version muet">Version ${VERSION}</p>
      </div>
    `);
    const msg = (t) => {
      document.getElementById(`cx-msg`).textContent = t;
    };
    const boutons = (inactifs) =>
      document.querySelectorAll(`#cx-form button`).forEach((b) => (b.disabled = inactifs));
    async function entrer(creer) {
      const email = document.getElementById(`cx-email`).value;
      const mdp = document.getElementById(`cx-mdp`).value;
      if (!email.includes(`@`) || mdp.length < 6) {
        msg(`Entre un email valide et un mot de passe d'au moins 6 caractères.`);
        return;
      }
      boutons(true);
      msg(creer ? `Création du compte…` : `Connexion…`);
      try {
        if (creer) {
          const r = await creerCompte(email, mdp);
          if (!r.connecte) {
            msg(
              `Compte créé. Ouvre le courriel de confirmation reçu, puis touche « Se connecter ».`,
            );
            boutons(false);
            return;
          }
        } else {
          await seConnecter(email, mdp);
        }
        msg(`✓ Connecté, chargement…`);
        setTimeout(() => location.reload(), 300);
      } catch (e) {
        msg(`✗ ${e.message}`);
        boutons(false);
      }
    }
    document.getElementById(`cx-form`).addEventListener(`submit`, (ev) => {
      ev.preventDefault();
      entrer(false);
    });
    document.getElementById(`cx-creer`).addEventListener(`click`, () => entrer(true));
    document.getElementById(`cx-sans`).addEventListener(`click`, () => {
      jouerSansCompte();
      resolve();
    });
  });
}
