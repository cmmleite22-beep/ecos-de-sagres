// Mots en français. Chaque thème a trois niveaux : facile, moyen, difficile (20 mots chacun).
const L = (s) => s.split(',').map((w) => w.trim()).filter(Boolean);

export default {
  animais: {
    nome: 'Animaux',
    n: [
      L('chat, chien, poisson, oiseau, vache, cochon, cheval, poule, lapin, souris, serpent, grenouille, canard, mouton, araignée, papillon, escargot, tortue, baleine, éléphant'),
      L('girafe, pieuvre, dauphin, requin, hibou, chauve-souris, abeille, fourmi, coccinelle, lion, singe, pingouin, chameau, crocodile, zèbre, kangourou, crabe, âne, lézard, flamant rose'),
      L('caméléon, hippocampe, hérisson, étoile de mer, méduse, perroquet, paon, rhinocéros, hippopotame, loutre, écureuil, taupe, calmar, pic-vert, autruche, mille-pattes, scorpion, morse, paresseux, ornithorynque'),
    ],
  },
  comida: {
    nome: 'Nourriture',
    n: [
      L('pomme, banane, pain, œuf, fromage, gâteau, glace, pizza, orange, raisin, carotte, fraise, lait, soupe, pomme de terre, tomate, poire, cerise, chocolat, bonbon'),
      L('ananas, pastèque, hamburger, spaghettis, sandwich, hot-dog, pop-corn, biscuit, yaourt, champignon, citron, maïs, ail, oignon, poivron, petits pois, saucisse, crêpe, jus, tartine'),
      L('croissant, baguette, croque-monsieur, escargots, ratatouille, quiche, sushi, omelette, éclair, sucette, macaron, gaufre, brioche, olive, châtaigne, brocoli, avocat, barbe à papa, milk-shake, gâteau d’anniversaire'),
    ],
  },
  casa: {
    nome: 'Maison et objets',
    n: [
      L('maison, chaise, table, lit, porte, fenêtre, livre, crayon, clé, verre, bouteille, horloge, lunettes, chaussure, chapeau, ballon, parapluie, téléphone, ampoule, ciseaux'),
      L('frigo, canapé, télévision, brosse à dents, oreiller, miroir, bougie, sac à dos, ordinateur, lampe, échelle, marteau, fourchette, cuillère, casserole, seau, savon, grille-pain, sèche-cheveux, cintre'),
      L('machine à laver, aspirateur, micro-ondes, ventilateur, télécommande, fer à repasser, réveil, agrafeuse, thermomètre, calculatrice, tire-bouchon, étendoir, bouilloire, règle, casque, chargeur, store, cheminée, coffre-fort, cadenas'),
    ],
  },
  natureza: {
    nome: 'Nature et lieux',
    n: [
      L('soleil, lune, étoile, arbre, fleur, nuage, pluie, mer, montagne, plage, rivière, neige, feu, arc-en-ciel, feuille, pierre, île, vague, volcan, éclair'),
      L('cascade, désert, forêt, lac, grotte, phare, pont, château, église, école, hôpital, parc, jardin, ferme, ville, tornade, cactus, palmier, orage, potager'),
      L('archipel, éclipse, cratère, brouillard, rosée, marée, glacier, belvédère, aéroport, gare, bibliothèque, musée, pharmacie, rond-point, feu rouge, passage piéton, moulin, marais, geyser, iceberg'),
    ],
  },
  acoes: {
    nome: 'Actions et métiers',
    n: [
      L('courir, sauter, dormir, manger, nager, pleurer, rire, danser, chanter, lire, écrire, boire, voler, peindre, médecin, pompier, policier, professeur, cuisinier, pêcheur'),
      L('pêcher, cuisiner, éternuer, bâiller, siffler, plonger, glisser, pousser, câliner, saluer, facteur, peintre, agriculteur, pilote, dentiste, mécanicien, astronaute, coiffeur, clown, infirmier'),
      L('trébucher, ronfler, équilibrer, cacher, applaudir, chuchoter, hypnotiser, architecte, plombier, électricien, vétérinaire, photographe, jardinier, magicien, détective, chef d’orchestre, maître-nageur, menuisier, scientifique, jongleur'),
    ],
  },
  lazer: {
    nome: 'Sport et loisirs',
    n: [
      L('football, vélo, ballon de baudruche, piscine, balançoire, toboggan, skateboard, patins, raquette, but, médaille, coupe, dé, piano, tambour, guitare, sifflet, tennis, ballon de plage, cadeau'),
      L('basket, volley, surf, échecs, karaté, gymnastique, bowling, camping, tente, trampoline, puzzle, yoyo, toupie, billes, corde à sauter, golf, ski, canoë, cerf-volant, violon'),
      L('parachute, deltaplane, montagnes russes, manège, grande roue, marathon, escalade, hockey, handball, arc et flèches, ping-pong, baby-foot, billard, fléchettes, saut à la perche, judo, rugby, plongée, kayak, feu d’artifice'),
    ],
  },
};
