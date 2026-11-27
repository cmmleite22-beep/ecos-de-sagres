// Wörter auf Deutsch. Jedes Thema hat drei Stufen: leicht, mittel, schwer (je 20 Wörter).
const L = (s) => s.split(',').map((w) => w.trim()).filter(Boolean);

export default {
  animais: {
    nome: 'Tiere',
    n: [
      L('Katze, Hund, Fisch, Vogel, Kuh, Schwein, Pferd, Huhn, Hase, Maus, Schlange, Frosch, Ente, Schaf, Spinne, Schmetterling, Schnecke, Schildkröte, Wal, Elefant'),
      L('Giraffe, Krake, Delfin, Hai, Eule, Fledermaus, Biene, Ameise, Marienkäfer, Löwe, Affe, Pinguin, Kamel, Krokodil, Zebra, Känguru, Krebs, Esel, Eidechse, Flamingo'),
      L('Chamäleon, Seepferdchen, Igel, Seestern, Qualle, Papagei, Pfau, Nashorn, Nilpferd, Otter, Eichhörnchen, Maulwurf, Tintenfisch, Specht, Strauß, Tausendfüßer, Skorpion, Walross, Faultier, Schnabeltier'),
    ],
  },
  comida: {
    nome: 'Essen',
    n: [
      L('Apfel, Banane, Brot, Ei, Käse, Kuchen, Eis, Pizza, Orange, Trauben, Karotte, Erdbeere, Milch, Suppe, Kartoffel, Tomate, Birne, Kirsche, Schokolade, Bonbon'),
      L('Ananas, Wassermelone, Hamburger, Spaghetti, Sandwich, Hotdog, Popcorn, Keks, Joghurt, Pilz, Zitrone, Mais, Knoblauch, Zwiebel, Paprika, Erbsen, Wurst, Pfannkuchen, Saft, Toast'),
      L('Brezel, Bratwurst, Sauerkraut, Schnitzel, Apfelstrudel, Lebkuchen, Sushi, Omelett, Döner, Lutscher, Waffel, Croissant, Berliner, Olive, Kastanie, Brokkoli, Avocado, Zuckerwatte, Milchshake, Geburtstagskuchen'),
    ],
  },
  casa: {
    nome: 'Haus und Dinge',
    n: [
      L('Haus, Stuhl, Tisch, Bett, Tür, Fenster, Buch, Bleistift, Schlüssel, Glas, Flasche, Uhr, Brille, Schuh, Hut, Ball, Regenschirm, Handy, Glühbirne, Schere'),
      L('Kühlschrank, Sofa, Fernseher, Zahnbürste, Kissen, Spiegel, Kerze, Rucksack, Computer, Lampe, Leiter, Hammer, Gabel, Löffel, Topf, Eimer, Seife, Toaster, Föhn, Kleiderbügel'),
      L('Waschmaschine, Staubsauger, Mikrowelle, Ventilator, Fernbedienung, Bügeleisen, Wecker, Hefter, Thermometer, Taschenrechner, Korkenzieher, Wäscheleine, Wasserkocher, Lineal, Kopfhörer, Ladegerät, Rollladen, Kamin, Tresor, Vorhängeschloss'),
    ],
  },
  natureza: {
    nome: 'Natur und Orte',
    n: [
      L('Sonne, Mond, Stern, Baum, Blume, Wolke, Regen, Meer, Berg, Strand, Fluss, Schnee, Feuer, Regenbogen, Blatt, Stein, Insel, Welle, Vulkan, Blitz'),
      L('Wasserfall, Wüste, Wald, See, Höhle, Leuchtturm, Brücke, Burg, Kirche, Schule, Krankenhaus, Park, Garten, Bauernhof, Stadt, Tornado, Kaktus, Palme, Gewitter, Gemüsebeet'),
      L('Inselgruppe, Finsternis, Krater, Nebel, Tau, Ebbe, Gletscher, Aussichtspunkt, Flughafen, Bahnhof, Bibliothek, Museum, Apotheke, Kreisverkehr, Ampel, Zebrastreifen, Windmühle, Sumpf, Geysir, Eisberg'),
    ],
  },
  acoes: {
    nome: 'Tätigkeiten und Berufe',
    n: [
      L('rennen, springen, schlafen, essen, schwimmen, weinen, lachen, tanzen, singen, lesen, schreiben, trinken, fliegen, malen, Arzt, Feuerwehrmann, Polizist, Lehrer, Koch, Fischer'),
      L('angeln, kochen, niesen, gähnen, pfeifen, tauchen, rutschen, schieben, umarmen, winken, Briefträger, Maler, Bauer, Pilot, Zahnarzt, Mechaniker, Astronaut, Friseur, Clown, Krankenschwester'),
      L('stolpern, schnarchen, balancieren, verstecken, klatschen, flüstern, hypnotisieren, Architekt, Klempner, Elektriker, Tierarzt, Fotograf, Gärtner, Zauberer, Detektiv, Dirigent, Rettungsschwimmer, Tischler, Wissenschaftler, Jongleur'),
    ],
  },
  lazer: {
    nome: 'Sport und Freizeit',
    n: [
      L('Fußball, Fahrrad, Luftballon, Schwimmbad, Schaukel, Rutsche, Skateboard, Rollschuhe, Schläger, Tor, Medaille, Pokal, Würfel, Klavier, Trommel, Gitarre, Pfeife, Tennis, Wasserball, Geschenk'),
      L('Basketball, Volleyball, Surfen, Schach, Karate, Turnen, Bowling, Camping, Zelt, Trampolin, Puzzle, Jojo, Kreisel, Murmeln, Springseil, Golf, Ski, Kanu, Drachen, Geige'),
      L('Fallschirm, Drachenflieger, Achterbahn, Karussell, Riesenrad, Marathon, Klettern, Eishockey, Handball, Pfeil und Bogen, Tischtennis, Tischfußball, Billard, Dart, Stabhochsprung, Judo, Rugby, Tauchen, Kajak, Feuerwerk'),
    ],
  },
};
