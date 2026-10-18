import { numeroZone, ajouterKamas, rareteSuivante } from "../jeu/economie.js";
import {
  tirerRencontre,
  rencontresExclues,
  idoleZone,
  traqueActive,
  dieuxProposes,
  BENEDICTIONS,
  peutCrocheter,
  gainBase,
  prixMarchand,
  idolesProposees,
  IDOLES,
  objetsForgeables,
  forgerGratuit,
  prixTemple,
  herosKO,
  PV_TEMPLE,
  releverHeros,
  zoneAArchis,
} from "../jeu/rencontres.js";
import {
  effetsDifficulte,
  pvMaxPerso,
  tirerObjet,
  peutGagnerXp,
  mondeSansArchimonstre,
  soignerEquipe,
} from "../jeu/run.js";
import { ecranRencontre } from "../ui/ecrans/rencontre.js";
import { soignerAvecGain, gagnerXpEquipe } from "./recompenses.js";
import { afficherBandeau } from "../ui/ecrans/succes.js";
import { ecranMessage } from "../ui/ecrans/message.js";
import {
  butinDeZone,
  calculerXpCombat,
  XP_PAR_COMBAT,
  CONFIG_ARCHI,
  RARETES_INFO,
} from "../jeu/config.js";
import { secretDuMonde, CHANCES_CLE, nomCle } from "../jeu/secret.js";
import { enregistrerCollection } from "../sauvegarde/meta.js";
import { meta } from "./etat.js";
import { ecranButin } from "../ui/ecrans/butin.js";
import { EQUIPEMENTS, CLASSES, RELIQUES_RUN } from "../data/index.js";
import {
  SACRIFICE_AUTEL,
  acheterReliqueRun,
  pacteAutel,
  prixReliqueRun,
  reliquesProposees,
} from "../jeu/cases.js";
import { NOMS_RARETES_CHOIX, sacrificePvRun, texteSynergies } from "../jeu/recompensesRun.js";

// Détail d'une relique dans une option de rencontre : rareté, effet et synergies.
export const detailRelique = (id, run) =>
  [
    `${NOMS_RARETES_CHOIX[RELIQUES_RUN[id].rarete] ?? ``} · ${RELIQUES_RUN[id].desc}`,
    texteSynergies(id, run),
  ]
    .filter(Boolean)
    .join(` `);

// ---------- Rencontres (case « Rencontre » de la carte) ----------
export async function jouerRencontre(run, zone) {
  let toile = zone ? numeroZone(zone.id) : 1;
  let type = tirerRencontre(
    Math.random,
    rencontresExclues(run, { mortDefinitive: !!effetsDifficulte(run.ascension).mortDefinitive }),
  );
  if (
    (type === `idoles` && idoleZone(run, zone?.id)) ||
    (type === `traque` && traqueActive(run, zone?.id))
  ) {
    type = `coffre`;
  }
  run.stats.rencontres = (run.stats.rencontres ?? 0) + 1;
  if (type === `sanctuaire`) {
    let dieux = dieuxProposes(run, Math.random);
    let choix = await ecranRencontre({
      equipe: run.persos,
      titre: `⛩️ Sanctuaire des Douze`,
      texte: `Un autel dédié aux dieux du Krosmoz se dresse au bord du chemin. Une seule prière sera exaucée.`,
      choix: [
        ...dieux.map((id) => ({
          id,
          img: `/assets/class_symbol/${id}.png`,
          libelle: `Prier ${BENEDICTIONS[id].dieu} : ${BENEDICTIONS[id].nom}`,
          detail: `${BENEDICTIONS[id].desc}, pour toute la run.`,
        })),
        { id: `soin`, libelle: `Se recueillir`, detail: `L'équipe récupère 30 % de ses PV max.` },
      ],
    });
    if (choix === `soin`) {
      let gain = soignerAvecGain(run, 0.3);
      afficherBandeau(`⛩️ Recueillement : +${gain} PV pour l'équipe`);
    } else {
      (run.benedictions ??= []).push(choix);
      let benediction = BENEDICTIONS[choix];
      afficherBandeau(
        `✨ ${benediction.dieu} exauce ta prière : ${benediction.desc} jusqu'à la fin de la run`,
      );
    }
    return;
  }
  if (type === `coffre`) {
    let crochet = peutCrocheter(run);
    let choix = await ecranRencontre({
      equipe: run.persos,
      titre: `🧰 Coffre abandonné`,
      img: `/assets/monstres/coffre_forgerons.png`,
      texte: `Un vieux coffre traîne au milieu du chemin. Trésor… ou piège ?`,
      choix: [
        {
          id: `ouvrir`,
          libelle: `L'ouvrir`,
          detail: `2 chances sur 3 : kamas, et peut-être un objet. Sinon, un piège blesse l'équipe (−20 % de PV max).`,
        },
        {
          id: `crocheter`,
          libelle: `Le crocheter prudemment`,
          detail: `Pas de piège : le trésor est garanti.`,
          desactive: crochet ? `` : `Il faut un Sram, un Roublard ou un Ecaflip dans l'équipe.`,
        },
        { id: `partir`, libelle: `Passer son chemin` },
      ],
    });
    if (choix === `partir`) {
      return;
    }
    if (choix === `ouvrir` && Math.random() < 1 / 3) {
      for (let perso of run.persos) {
        if (perso.pvActuels > 0) {
          perso.pvActuels = Math.max(1, Math.round(perso.pvActuels - pvMaxPerso(perso) * 0.2));
        }
      }
      await ecranMessage(
        `💥 Piège !`,
        `Le coffre était piégé : chaque héros perd 20 % de ses PV max.`,
      );
      return;
    }
    let kamas = Math.round(gainBase(toile) * 1.5);
    ajouterKamas(run, kamas);
    let texte = `Le coffre contenait ${kamas} kamas.`;
    let objet = null;
    let butin = zone ? butinDeZone(zone.id) : null;
    if (!run.cle && secretDuMonde(run.trancheId) && Math.random() < CHANCES_CLE.coffre) {
      run.cle = true;
      texte += ` Au fond, une clé : la ${nomCle(run.trancheId)} ! Elle ouvre le donjon secret du monde.`;
    } else if (butin?.normales.length && Math.random() < 0.45) {
      let obj = tirerObjet(
        butin.normales[Math.floor(Math.random() * butin.normales.length)],
        Math.random,
      );
      if (obj) {
        run.inventaire.push(obj);
        enregistrerCollection(meta, [obj]);
        objet = obj;
      }
    }
    if (objet) {
      // l'objet trouvé passe par l'écran de butin (à qui il sert, équipement immédiat)
      await ecranButin([objet], run, `💰 ${texte} Et un objet !`);
    } else {
      await ecranMessage(`💰 Trésor`, texte);
    }
    return;
  }
  if (type === `marchand`) {
    let prix = prixMarchand(toile);
    let achete = new Set();
    let xp = calculerXpCombat(XP_PAR_COMBAT.combat_dur, toile, run.trancheId);
    while (true) {
      let offre = (id, libelle, detail) => ({
        id,
        libelle,
        detail,
        prix: prix[id],
        desactive: achete.has(id)
          ? `Déjà acheté.`
          : run.kamas < prix[id]
            ? `Pas assez de kamas.`
            : ``,
      });
      let choix = await ecranRencontre({
        equipe: run.persos,
        titre: `🧳 Marchand ambulant`,
        img: `/assets/divers/potion_de_soin.png`,
        texte: `Kerubim Crépin, l'antiquaire de Bonta, est en vadrouille et déballe quelques trouvailles.`,
        kamas: run.kamas,
        choix: [
          offre(`potion`, `Potion de Soin`, `L'équipe récupère 40 % de ses PV max.`),
          // plus d'XP à gagner (niveau max du monde) : le Parchemin est inutile
          ...(run.persos.some((perso) => peutGagnerXp(perso, run.trancheId))
            ? [offre(`parchemin`, `Parchemin d'expérience`, `${xp} XP pour chaque héros.`)]
            : []),
          // aucun archimonstre dans ce monde : le Philtre est inutile
          ...(mondeSansArchimonstre(run.trancheId)
            ? []
            : [
                {
                  ...offre(
                    `philtre`,
                    `Philtre d'Otomaï`,
                    `Les archimonstres apparaissent plus souvent pour le reste de la run.`,
                  ),
                  ...((run.philtres ?? 0) >= CONFIG_ARCHI.philtresMax
                    ? {
                        desactive: `Effet déjà au maximum (${CONFIG_ARCHI.philtresMax}/${CONFIG_ARCHI.philtresMax})`,
                      }
                    : {}),
                },
              ]),
          { id: `partir`, libelle: `Repartir` },
        ],
      });
      if (choix === `partir`) {
        return;
      }
      run.kamas -= prix[choix];
      achete.add(choix);
      if (choix === `potion`) {
        soignerEquipe(run, 0.4);
      } else if (choix === `parchemin`) {
        gagnerXpEquipe(run, xp);
      } else {
        run.philtres += 1;
      }
    }
  }
  if (type === `colporteur`) {
    // trois reliques de run, une seule achetable, prix selon la rareté
    let ids = reliquesProposees(run, Math.random, 3);
    let choix = await ecranRencontre({
      equipe: run.persos,
      titre: `🎒 Colporteur de reliques`,
      texte: `Un colporteur pandawa ouvre sa besace : « Une seule par client, l'ami. Elles te serviront jusqu'au bout du voyage. »`,
      kamas: run.kamas,
      choix: [
        ...ids.map((id) => {
          let prix = prixReliqueRun(id, toile);
          return {
            id,
            libelle: `${RELIQUES_RUN[id].icone} ${RELIQUES_RUN[id].nom}`,
            prix,
            detail: detailRelique(id, run),
            desactive: run.kamas < prix ? `Pas assez de kamas.` : ``,
          };
        }),
        { id: `partir`, libelle: `Repartir` },
      ],
    });
    if (choix !== `partir` && acheterReliqueRun(run, choix, prixReliqueRun(choix, toile))) {
      afficherBandeau(
        `${RELIQUES_RUN[choix].icone} ${RELIQUES_RUN[choix].nom} : ${RELIQUES_RUN[choix].desc}`,
      );
    }
    return;
  }
  if (type === `autel_sang`) {
    // deux reliques plutôt rares, contre des PV max (en combat) jusqu'à la fin de la run
    let ids = reliquesProposees(run, Math.random, 2, { commun: 15, rare: 55, epique: 30 });
    let pct = Math.round(SACRIFICE_AUTEL * 100);
    let deja = Math.round(sacrificePvRun(run) * 100);
    let choix = await ecranRencontre({
      equipe: run.persos,
      titre: `🩸 Autel de sang`,
      texte: `Un autel couvert de runes rougeoie. Une voix murmure : « Un peu de ta vigueur… contre un trésor. »${deja ? ` Tu as déjà donné ${deja} % de tes PV max.` : ``}`,
      choix: [
        ...ids.map((id) => ({
          id,
          libelle: `${RELIQUES_RUN[id].icone} ${RELIQUES_RUN[id].nom} (−${pct} % de PV max)`,
          detail: `${detailRelique(id, run)} En échange, chaque héros a ${pct} % de PV max en moins en combat, pour toute la run.`,
        })),
        { id: `partir`, libelle: `Refuser le pacte` },
      ],
    });
    if (choix !== `partir` && pacteAutel(run, choix)) {
      afficherBandeau(
        `🩸 Pacte scellé : ${RELIQUES_RUN[choix].icone} ${RELIQUES_RUN[choix].nom}, −${pct} % de PV max en combat`,
      );
    }
    return;
  }
  if (type === `cle`) {
    let prix = prixMarchand(toile).cle;
    let secret = secretDuMonde(run.trancheId);
    let choix = await ecranRencontre({
      equipe: run.persos,
      titre: `🗝️ ${nomCle(run.trancheId)}`,
      img: `/assets/divers/cle_donjon.png`,
      texte: `Un contrebandier encapuchonné fait tinter une vieille clé : « Elle ouvre le ${secret.nom}. Pour qui ose y entrer… »`,
      kamas: run.kamas,
      choix: [
        {
          id: `acheter`,
          libelle: `Acheter la clé`,
          prix,
          detail: `Après le boss d'une zone, tu pourras entrer dans le donjon secret (2 objets épiques ou légendaires garantis).`,
          desactive: run.kamas < prix ? `Pas assez de kamas.` : ``,
        },
        {
          id: `des`,
          libelle: `La jouer aux dés`,
          detail: `Une chance sur deux : la clé gratuite. Sinon, tu perds ${Math.round(prix / 2)} kamas.`,
          desactive: run.kamas < Math.round(prix / 2) ? `Pas assez de kamas pour la mise.` : ``,
        },
        { id: `partir`, libelle: `Passer son chemin` },
      ],
    });
    if (choix === `acheter`) {
      run.kamas -= prix;
      run.cle = true;
      afficherBandeau(`🗝️ La ${nomCle(run.trancheId)} est à toi`);
    } else if (choix === `des` && run.kamas >= Math.round(prix / 2)) {
      if (Math.random() < 0.5) {
        run.cle = true;
        await ecranMessage(
          `🎲 Gagné !`,
          `Le contrebandier grommelle et te tend la ${nomCle(run.trancheId)}.`,
        );
      } else {
        let perte = Math.min(run.kamas, Math.round(prix / 2));
        run.kamas -= perte;
        await ecranMessage(
          `🎲 Perdu…`,
          `Le contrebandier empoche ${perte} kamas et disparaît dans la foule.`,
        );
      }
    }
    return;
  }
  if (type === `idoles`) {
    // plus d'XP à gagner : l'idole Nahuatl (bonus d'XP seul) n'a aucun intérêt
    let ids = idolesProposees(Math.random).filter(
      (id) => id !== `nahuatl` || run.persos.some((perso) => peutGagnerXp(perso, run.trancheId)),
    );
    let choix = await ecranRencontre({
      equipe: run.persos,
      titre: `🗿 Autel des Idoles`,
      texte: `Des idoles anciennes promettent gloire et richesses à qui ose les porter… jusqu'à la fin de la zone.`,
      choix: [
        ...ids.map((id) => ({
          id,
          libelle: IDOLES[id].nom,
          detail: `${IDOLES[id].malus} · ${IDOLES[id].bonus}`,
        })),
        { id: `partir`, libelle: `Ne pas tenter le sort` },
      ],
    });
    if (choix !== `partir`) {
      run.idole = { id: choix, zone: zone?.id };
      afficherBandeau(
        `🗿 ${IDOLES[choix].nom} jusqu'à la fin de la zone : ${IDOLES[choix].malus} ; ${IDOLES[choix].bonus}`,
      );
    }
    return;
  }
  if (type === `forgemage`) {
    let objets = objetsForgeables(run);
    let choix = await ecranRencontre({
      equipe: run.persos,
      titre: `🔨 Forgemage itinérant`,
      texte: `Un forgemage au tablier brûlé propose de monter un objet d'un palier de rareté, gratuitement et sans risque. Une seule fois.`,
      choix: [
        ...objets.map((objet, indice) => ({
          id: `o${indice}`,
          img: `/assets/items/${objet.id}.png`,
          libelle: `${EQUIPEMENTS[objet.id]?.nom ?? objet.id} (${RARETES_INFO[objet.rarete].nom})`,
          detail: `Passe en ${RARETES_INFO[rareteSuivante(objet)].nom}.`,
        })),
        { id: `partir`, libelle: `Passer son chemin` },
      ],
    });
    let objetChoisi = objets[Number(choix.slice(1))];
    if (choix !== `partir` && objetChoisi) {
      let nom = EQUIPEMENTS[objetChoisi.id]?.nom ?? objetChoisi.id;
      forgerGratuit(objetChoisi);
      for (let perso of run.persos) {
        perso.pvActuels = Math.min(perso.pvActuels, pvMaxPerso(perso));
      }
      enregistrerCollection(meta, [objetChoisi]);
      afficherBandeau(`🔨 ${nom} → ${RARETES_INFO[objetChoisi.rarete].nom}`);
    }
    return;
  }
  if (type === `temple`) {
    let prix = prixTemple(toile);
    let ko = herosKO(run);
    let choix = await ecranRencontre({
      equipe: run.persos,
      titre: `⛪ Temple de résurrection`,
      texte: `Des prêtres veillent sur un autel de lumière : contre une offrande, ils relèvent un héros tombé avec ${Math.round(PV_TEMPLE * 100)} % de ses PV max.`,
      kamas: run.kamas,
      choix: [
        ...ko.map((perso) => ({
          id: perso.classeId,
          img: `/assets/class_symbol/${perso.classeId}.png`,
          libelle: `Relever ${CLASSES[perso.classeId]?.nom ?? perso.classeId}`,
          prix,
          desactive: run.kamas < prix ? `Pas assez de kamas.` : ``,
        })),
        { id: `partir`, libelle: `Repartir` },
      ],
    });
    let heros = ko.find((perso) => perso.classeId === choix);
    if (heros && run.kamas >= prix) {
      run.kamas -= prix;
      releverHeros(heros);
      afficherBandeau(
        `⛪ ${CLASSES[heros.classeId]?.nom ?? heros.classeId} est relevé (−${prix} kamas)`,
      );
    }
    return;
  }
  // avis de recherche : traque d'un archimonstre, ou prime si la zone n'en a pas
  let archi = zone ? zoneAArchis(zone) : false;
  let choixAvis = await ecranRencontre({
    equipe: run.persos,
    titre: `📜 Avis de recherche`,
    img: `/assets/divers/avis_de_recherche.png`,
    texte: archi
      ? `Un archimonstre rôde dans la zone. Un chasseur de primes te propose de le traquer.`
      : `Une bande de monstres est recherchée dans la zone, avec une belle prime à la clé.`,
    choix: [
      {
        id: `accepter`,
        libelle: archi ? `Traquer l'archimonstre` : `Accepter la prime`,
        detail: archi
          ? `Le prochain combat contiendra un archimonstre, mais ses monstres auront +20 % de PV.`
          : `Le prochain combat rapportera le double de kamas, mais ses monstres auront +20 % de PV.`,
      },
      { id: `partir`, libelle: `Décliner` },
    ],
  });
  if (choixAvis === `accepter`) {
    run.traque = { zone: zone?.id, archi };
  }
}
