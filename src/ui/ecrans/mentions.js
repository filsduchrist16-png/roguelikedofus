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
        <h2>Crédits des images</h2>
        <p>Les portraits de classe, les symboles de classe et les icônes de sorts sont des créations
          d'<b>Ankama Games</b> pour DOFUS. Les portraits des classes Osamodas, Enutrof, Sacrieur,
          Pandawa, Zobal, Steamer et Huppermage proviennent de l'encyclopédie officielle
          (<a href="https://www.dofus.com/fr/mmorpg/encyclopedie/classes" target="_blank" rel="noopener noreferrer">dofus.com</a>) ;
          les icônes de sorts et les symboles proviennent de
          <a href="https://dofusdb.fr" target="_blank" rel="noopener noreferrer">DofusDB</a>, base de données
          communautaire de DOFUS. Les créatures sont tirées des illustrations du jeu.</p>
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
