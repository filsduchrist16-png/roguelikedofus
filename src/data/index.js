import SORTS from "./sorts.json";
import CLASSES from "./classes.json";
import MONSTRES from "./monstres.json";
import COMBATS from "./combats.json";
import POOLS_ZONES from "./poolsZones.json";
import EQUIPEMENTS from "./equipements.json";
import BUTIN_ZONES from "./butinZones.json";
import SUCCES from "./succes.json";
import CREATURES from "./creatures.json";
import RELIQUES from "./reliques.json";
export const CONFIG_RELIQUES = {
  base: 0.01,
  parCran: 0.01,
  diviseurProspection: 25,
};
const LISTE_DOFUS = [
  [`dofus_pourpre`, `Dofus Pourpre`],
  [`dofus_turquoise`, `Dofus Turquoise`],
  [`dofus_emeraude`, `Dofus Émeraude`],
  [`dofus_ocre`, `Dofus Ocre`],
  [`dofus_ivoire`, `Dofus Ivoire`],
  [`dofus_ebene`, `Dofus Ébène`],
  [`dofus_vulbis`, `Dofus Vulbis`],
  [`dofus_abyssal`, `Dofus Abyssal`],
  [`dofus_cawotte`, `Dofus Cawotte`],
  [`dolmanax`, `Dolmanax`],
  [`dofus_des_veilleurs`, `Dofus des Veilleurs`],
  [`dofus_du_cauchemar`, `Dofus du Cauchemar`],
  [`dofus_des_glaces`, `Dofus des Glaces`],
  [`dofus_forgelave`, `Dofus Forgelave`],
  [`dofus_kaliptus`, `Dofus Kaliptus`],
  [`dofus_nebuleux`, `Dofus Nébuleux`],
  [`dofus_sylvestre`, `Dofus Sylvestre`],
  [`dofus_verdoyant`, `Dofus Verdoyant`],
  [`dofus_tachete`, `Dofus Tacheté`],
  [`dofus_argente`, `Dofus Argenté`],
  [`dofus_argente_scintillant`, `Dofus Argenté Scintillant`],
  [`dofus_cacao`, `Dofus Cacao`],
  [`dofawa`, `Dofawa`],
  [`dofoozbz`, `Dofoozbz`],
  [`dokille`, `Dokille`],
  [`dokoko`, `Dokoko`],
  [`dom_de_pin`, `Dom de Pin`],
  [`domakuro`, `Domakuro`],
  [`dorigami`, `Dorigami`],
  [`dotruche`, `Dotruche`],
  [`jyfus`, `Jyfus`],
];
const EFFETS_DOFUS = {
  dofus_vulbis: {
    desc: `+5 % de dégâts finaux et +5 % de résistance dans chaque élément.`,
    degatsPct: 0.05,
    resAll: 0.05,
  },
  dofus_abyssal: {
    desc: `Au début de son tour, un héros de la ligne arrière gagne un bouclier de 5 % de ses PV max pour 1 tour.`,
  },
  dofus_cawotte: {
    desc: `+8 % de PV max pour toute l'équipe.`,
    pvPct: 0.08,
  },
  dofus_sylvestre: {
    desc: `Chaque héros régénère 3 % de ses PV max au début de son tour.`,
  },
  dofus_verdoyant: {
    desc: `+15 % de dégâts contre les ennemis empoisonnés ou infectés.`,
  },
  dofus_cacao: {
    desc: `+20 % de kamas gagnés en combat.`,
    multKamas: 1.2,
  },
  dofus_forgelave: {
    desc: `Les coups critiques de l'équipe brûlent la cible : 15 % des dégâts du coup, par tour, pendant 2 tours.`,
  },
  dofoozbz: {
    desc: `+20 en prospection pour toute l'équipe.`,
    prospectionPlat: 20,
  },
  dokille: {
    desc: `Une fois par combat, le premier héros qui devrait tomber sous un coup reste debout avec 1 PV.`,
  },
  dom_de_pin: {
    desc: `Au début de chaque combat, toute l'équipe gagne un bouclier de 8 % de ses PV max pour 2 tours.`,
    bouclierDebutPct: 0.08,
  },
  dotruche: {
    desc: `+5 d'initiative et +3 % d'esquive pour toute l'équipe.`,
    initiativeBonus: 5,
    esquiveBonus: 0.03,
  },
  jyfus: {
    desc: `+10 % de soins prodigués par toute l'équipe.`,
    soinPlat: 20,
  },
  dofus_pourpre: {
    desc: `+6 en force, intelligence, agilité et chance.`,
    statsElementaires: 6,
  },
  dolmanax: {
    desc: `+10 en force, intelligence, agilité et chance.`,
    statsElementaires: 10,
  },
  dofus_ivoire: {
    desc: `+5 % de résistance dans chaque élément.`,
    resAll: 0.05,
  },
  dofus_ebene: {
    desc: `+1 % de dégâts finaux.`,
    degatsPct: 0.01,
  },
  dofus_turquoise: {
    desc: `+10 % de chance de coup critique.`,
    critPlat: 10,
  },
  dofus_des_glaces: {
    desc: `Les dégâts ignorent 5 % des résistances ennemies.`,
    perceResistances: 0.05,
  },
  dofawa: {
    desc: `+1 PV max.`,
    pvBonus: 1,
  },
  dofus_kaliptus: {
    desc: `+1 à 30 en prospection, selon le meilleur exemplaire obtenu.`,
    prospectionJet: [1, 30],
  },
  dofus_argente: {
    desc: `Une fois par combat, sous 20 % de ses PV, soigne de 20 % des PV max au début du tour suivant.`,
  },
  dofus_argente_scintillant: {
    desc: `Une fois par combat, sous 20 % de ses PV, soigne de 20 % des PV max au début du tour suivant. +10 % de dégâts finaux.`,
    degatsPct: 0.1,
  },
  dokoko: {
    desc: `Un tour sur deux, soigne de 10 % des PV max en début de tour.`,
  },
  dofus_nebuleux: {
    desc: `+5 % de dégâts finaux les tours pairs, −5 % les tours impairs.`,
  },
  dofus_ocre: {
    desc: `+1 PA à toute l'équipe, une fois tous les archimonstres capturés.`,
    paBonus: 1,
  },
  dofus_emeraude: {
    desc: `En fin de tour, octroie 3 % des PV max en bouclier par ennemi en ligne avant, pour 1 tour.`,
  },
  dofus_des_veilleurs: {
    desc: `En fin de tour, soigne les alliés de sa ligne de 5 % de ses PV max. Non cumulable.`,
  },
  dorigami: {
    desc: `Quand il abat un ennemi, octroie 20 % des PV max en bouclier pour 1 tour.`,
  },
  dofus_tachete: {
    desc: `Quand il inflige des dégâts, octroie 5 en force, intelligence, agilité et chance à ses alliés pour 1 tour. Non cumulable.`,
  },
  domakuro: {
    desc: `S'il n'inflige aucun dégât lors de son premier tour, gagne 1 % de dégâts finaux pour le reste du combat.`,
  },
  dofus_du_cauchemar: {
    desc: `Le premier personnage de l'équipe joue toujours en premier.`,
  },
};
export const DOFUS = Object.fromEntries(
  LISTE_DOFUS.map(([id, nom]) => {
    const effet = EFFETS_DOFUS[id] ?? {};
    return [
      id,
      {
        ...effet,
        id,
        nom,
        desc: effet.desc ?? `Relique légendaire — effet à venir.`,
        img: `/assets/dofus/${id}.png`,
      },
    ];
  }),
);
export const ZONES = [
  {
    id: `incarnam`,
    nom: `Incarnam`,
    sansNoeuds: [`otomai`, `forgemagie`],
  },
  {
    id: `astrub`,
    nom: `Champs d'Astrub`,
  },
  {
    id: `tainela`,
    nom: `Tainéla`,
  },
  {
    id: `tofus`,
    nom: `Donjon des Tofus`,
  },
  {
    id: `scarafeuilles`,
    nom: `Donjon des Scarafeuilles`,
  },
  {
    id: `forgerons`,
    nom: `Donjon des Forgerons`,
  },
  {
    id: `akademie`,
    nom: `Akadémie des Gobs`,
  },
  {
    id: `kankreblath`,
    nom: `Cache de Kankreblath`,
  },
  {
    id: `maison_fantome`,
    nom: `Maison Fantôme`,
  },
  {
    id: `larves`,
    nom: `Donjon des Larves`,
  },
  {
    id: `grotte_hesque`,
    nom: `Grotte Hesque`,
  },
  {
    id: `kwakwa`,
    nom: `Nid du Kwakwa`,
  },
  {
    id: `clos_des_blops`,
    nom: `Clos des Blops`,
  },
  {
    id: `cale_de_l_arche`,
    nom: `Cale de l'Arche d'Otomaï`,
  },
  {
    id: `gelaxieme_dimension`,
    nom: `Gelaxième Dimension`,
  },
  {
    id: `laboratoire_brumen`,
    nom: `Laboratoire de Brumen Tinctorias`,
  },
  {
    id: `terrier_wa_wabbit`,
    nom: `Terrier du Wa Wabbit`,
  },
  {
    id: `pitons_rocheux`,
    nom: `Pitons Rocheux des Craqueleurs`,
  },
  {
    id: `bateau_du_chouque`,
    nom: `Bateau du Chouque & Village Kanniboul`,
  },
  {
    id: `antre_dragon_cochon`,
    nom: `Antre du Dragon Cochon`,
  },
  {
    id: `repaire_kharnozor`,
    nom: `Repaire du Kharnozor & Épreuve de Draegnerys`,
  },
  {
    id: `taniere_meulou`,
    nom: `Tanière du Meulou`,
  },
  {
    id: `domaine_ancestral`,
    nom: `Domaine Ancestral & Antre de la Reine Nyée`,
  },
  {
    id: `arbre_de_moon`,
    nom: `Arbre de Moon`,
  },
  {
    id: `egouts_bonta_brakmar`,
    nom: `Garde-manger du Rat Blanc & Sousouricière du Rat Noir`,
  },
  {
    id: `bibliotheque_corbac`,
    nom: `Bibliothèque du Maître Corbac`,
  },
  {
    id: `goulet_rasboul`,
    nom: `Goulet du Rasboul`,
  },
  {
    id: `antre_blop_multicolore`,
    nom: `Antre du Blop Multicolore Royal`,
  },
  {
    id: `tofulailler_royal`,
    nom: `Tofulailler Royal`,
  },
  {
    id: `antre_crocabulia`,
    nom: `Antre de Crocabulia`,
  },
  {
    id: `labyrinthe_minotoror`,
    nom: `Centre du Labyrinthe du Minotoror`,
  },
  {
    id: `vallee_dame_des_eaux`,
    nom: `Vallée de la Dame des eaux`,
  },
  {
    id: `dojo_du_vent`,
    nom: `Dojo du Vent`,
  },
  {
    id: `laboratoire_tynril`,
    nom: `Laboratoire du Tynril`,
  },
  {
    id: `excavation_mansot`,
    nom: `Excavation du Mansot Royal`,
  },
  {
    id: `epave_grolandais`,
    nom: `Épave du Grolandais violent`,
  },
  {
    id: `canopee_kimbo`,
    nom: `Canopée du Kimbo`,
  },
  {
    id: `hypogee_obsidiantre`,
    nom: `Hypogée de l'Obsidiantre`,
  },
  {
    id: `salle_minotot`,
    nom: `Salle du Minotot`,
  },
  {
    id: `tombe_tofugawa`,
    nom: `Tombe du Shogun Tofugawa`,
  },
  {
    id: `cavernes_givrefoux`,
    nom: `Cavernes Givrefoux`,
  },
  {
    id: `horologium_xlii`,
    nom: `Horologium de XLII`,
  },
  {
    id: `antre_korriandre`,
    nom: `Antre du Korriandre`,
  },
  {
    id: `antre_kralamoure`,
    nom: `Antre du Kralamoure Géant`,
  },
  {
    id: `grotte_bworker`,
    nom: `Grotte du Bworker`,
  },
  {
    id: `temple_ougah`,
    nom: `Temple du Grand Ougah`,
  },
  {
    id: `antichambre_glourseleste`,
    nom: `Antichambre du Glourséleste`,
  },
  {
    id: `pyramide_ombre`,
    nom: `Pyramide d'Ombre`,
  },
  {
    id: `forgefroide_frizz`,
    nom: `Forgefroide de Missiz Frizz`,
  },
  {
    id: `transporteur_sylargh`,
    nom: `Transporteur de Sylargh`,
  },
  {
    id: `salons_klime`,
    nom: `Salons privés de Klime`,
  },
  {
    id: `laboratoire_nileza`,
    nom: `Laboratoire de Nileza`,
  },
  {
    id: `donjon_harebourg`,
    nom: `Donjon du Comte Harebourg`,
  },
  {
    id: `aquadome_merkator`,
    nom: `Aquadôme de Merkator`,
  },
  {
    id: `vaisseau_meno`,
    nom: `Vaisseau du Capitaine Meno`,
  },
  {
    id: `temple_koutoulou`,
    nom: `Temple de Koutoulou`,
  },
  {
    id: `palais_dantinea`,
    nom: `Palais de Dantinéa`,
  },
  {
    id: `arbre_mort_trone_sang`,
    nom: `Arbre de Mort & Trône de Sang`,
  },
  {
    id: `fers_tyrannie_balance`,
    nom: `Fers de la Tyrannie & Sentence de la Balance`,
  },
  {
    id: `tempete_eliocalypse`,
    nom: `Tempête de l'Eliocalypse`,
  },
].map((e) => ({
  ...e,
  pools: POOLS_ZONES[e.id],
}));
export const MONDES = [
  {
    id: `t1`,
    nom: `Monde 1`,
    niveaux: [1, 50],
    zones: [
      `incarnam`,
      `astrub`,
      `tainela`,
      `tofus`,
      `akademie`,
      `kankreblath`,
      `maison_fantome`,
      `scarafeuilles`,
      `forgerons`,
      `larves`,
      `grotte_hesque`,
      `kwakwa`,
    ],
  },
  {
    id: `t2`,
    nom: `Monde 2`,
    niveaux: [50, 100],
    xpMult: 1.35,
    zones: [
      `clos_des_blops`,
      `cale_de_l_arche`,
      `gelaxieme_dimension`,
      `laboratoire_brumen`,
      `terrier_wa_wabbit`,
      `pitons_rocheux`,
      `bateau_du_chouque`,
      `antre_dragon_cochon`,
      `repaire_kharnozor`,
      `taniere_meulou`,
      `domaine_ancestral`,
      `arbre_de_moon`,
    ],
  },
  {
    id: `t3`,
    nom: `Monde 3`,
    niveaux: [100, 150],
    xpMult: 2.2,
    zones: [
      `egouts_bonta_brakmar`,
      `bibliotheque_corbac`,
      `goulet_rasboul`,
      `antre_blop_multicolore`,
      `tofulailler_royal`,
      `antre_crocabulia`,
      `labyrinthe_minotoror`,
      `vallee_dame_des_eaux`,
      `dojo_du_vent`,
      `laboratoire_tynril`,
      `excavation_mansot`,
      `epave_grolandais`,
    ],
  },
  {
    id: `t4`,
    nom: `Monde 4`,
    niveaux: [150, 199],
    xpMult: 3.2,
    zones: [
      `canopee_kimbo`,
      `hypogee_obsidiantre`,
      `salle_minotot`,
      `tombe_tofugawa`,
      `cavernes_givrefoux`,
      `horologium_xlii`,
      `antre_korriandre`,
      `antre_kralamoure`,
      `grotte_bworker`,
      `temple_ougah`,
      `antichambre_glourseleste`,
      `pyramide_ombre`,
    ],
  },
  {
    id: `t5`,
    nom: `Monde 5`,
    niveaux: [200, 200],
    zones: [
      `forgefroide_frizz`,
      `transporteur_sylargh`,
      `salons_klime`,
      `laboratoire_nileza`,
      `donjon_harebourg`,
      `aquadome_merkator`,
      `vaisseau_meno`,
      `temple_koutoulou`,
      `palais_dantinea`,
      `arbre_mort_trone_sang`,
      `fers_tyrannie_balance`,
      `tempete_eliocalypse`,
    ],
  },
];
export { SORTS, CLASSES, MONSTRES, COMBATS, EQUIPEMENTS, BUTIN_ZONES, SUCCES, RELIQUES, CREATURES };
