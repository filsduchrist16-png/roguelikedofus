import { afficherEcran, barreRetour } from "../commun.js";
export function ecranMentionsLegales() {
  return new Promise((resolve) => {
    afficherEcran(`
      <h1>Mentions légales</h1>
      <div class="disclaimer-texte">
        <p><b>Roguefus Lite est un fangame non officiel</b>, fait par des fans de Dofus.
          Il n'est ni affilié à Ankama, ni soutenu ou validé par Ankama.</p>
        <p>DOFUS, son univers, ses personnages, ses illustrations et ses marques appartiennent
          à Ankama et à leurs ayants droit.</p>
        <p>Le jeu est <b>gratuit et sans but lucratif</b>. Il n'y a ni paiement, ni don, ni achat.</p>
        <p>Le vrai Dofus, c'est sur
          <a href="https://www.dofus.com" target="_blank" rel="noopener noreferrer">dofus.com</a>.
          Les autres jeux d'Ankama sont sur
          <a href="https://www.ankama.com" target="_blank" rel="noopener noreferrer">ankama.com</a>.</p>
        <p>Vous avez des droits sur un élément du jeu et souhaitez qu'il soit retiré ?
          <a href="https://github.com/Adam-Serghini/RogueLiteDofus/issues" target="_blank" rel="noopener noreferrer">Contactez-nous</a>,
          on le retirera au plus vite.</p>
      </div>
      ${barreRetour(`disclaimer-retour`)}
    `);
    document.getElementById(`disclaimer-retour`)?.addEventListener(`click`, () => resolve());
  });
}
