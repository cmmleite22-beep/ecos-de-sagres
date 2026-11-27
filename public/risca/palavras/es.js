// Palabras en español. Cada tema tiene tres niveles: fácil, medio, difícil (20 palabras cada uno).
const L = (s) => s.split(',').map((w) => w.trim()).filter(Boolean);

export default {
  animais: {
    nome: 'Animales',
    n: [
      L('gato, perro, pez, pájaro, vaca, cerdo, caballo, gallina, conejo, ratón, serpiente, rana, pato, oveja, araña, mariposa, caracol, tortuga, ballena, elefante'),
      L('jirafa, pulpo, delfín, tiburón, búho, murciélago, abeja, hormiga, mariquita, león, mono, pingüino, camello, cocodrilo, cebra, canguro, cangrejo, burro, lagarto, flamenco'),
      L('camaleón, caballito de mar, erizo, estrella de mar, medusa, loro, pavo real, rinoceronte, hipopótamo, nutria, ardilla, topo, calamar, pájaro carpintero, avestruz, ciempiés, escorpión, morsa, perezoso, ornitorrinco'),
    ],
  },
  comida: {
    nome: 'Comida',
    n: [
      L('manzana, plátano, pan, huevo, queso, tarta, helado, pizza, naranja, uvas, zanahoria, fresa, leche, sopa, patata, tomate, pera, cereza, chocolate, caramelo'),
      L('piña, sandía, hamburguesa, espaguetis, bocadillo, perrito caliente, palomitas, galleta, yogur, champiñón, limón, maíz, ajo, cebolla, pimiento, guisantes, salchicha, tortita, zumo, tostada'),
      L('paella, tortilla de patatas, churros, gazpacho, empanada, croqueta, sushi, taco, burrito, piruleta, flan, magdalena, cruasán, aceituna, castaña, brócoli, aguacate, algodón de azúcar, batido, tarta de cumpleaños'),
    ],
  },
  casa: {
    nome: 'Casa y objetos',
    n: [
      L('casa, silla, mesa, cama, puerta, ventana, libro, lápiz, llave, vaso, botella, reloj, gafas, zapato, sombrero, pelota, paraguas, móvil, bombilla, tijeras'),
      L('nevera, sofá, televisión, cepillo de dientes, almohada, espejo, vela, mochila, ordenador, lámpara, escalera, martillo, tenedor, cuchara, olla, cubo, jabón, tostadora, secador, percha'),
      L('lavadora, aspiradora, microondas, ventilador, mando a distancia, plancha, despertador, grapadora, termómetro, calculadora, sacacorchos, tendedero, tetera, regla, auriculares, cargador, persiana, chimenea, caja fuerte, candado'),
    ],
  },
  natureza: {
    nome: 'Naturaleza y lugares',
    n: [
      L('sol, luna, estrella, árbol, flor, nube, lluvia, mar, montaña, playa, río, nieve, fuego, arcoíris, hoja, piedra, isla, ola, volcán, rayo'),
      L('cascada, desierto, bosque, lago, cueva, faro, puente, castillo, iglesia, escuela, hospital, parque, jardín, granja, ciudad, tornado, cactus, palmera, tormenta, huerto'),
      L('archipiélago, eclipse, cráter, niebla, rocío, marea, glaciar, mirador, aeropuerto, estación, biblioteca, museo, farmacia, rotonda, semáforo, paso de cebra, molino, pantano, géiser, iceberg'),
    ],
  },
  acoes: {
    nome: 'Acciones y profesiones',
    n: [
      L('correr, saltar, dormir, comer, nadar, llorar, reír, bailar, cantar, leer, escribir, beber, volar, pintar, médico, bombero, policía, profesor, cocinero, pescador'),
      L('pescar, cocinar, estornudar, bostezar, silbar, bucear, resbalar, empujar, abrazar, saludar, cartero, pintor, agricultor, piloto, dentista, mecánico, astronauta, peluquero, payaso, enfermero'),
      L('tropezar, roncar, equilibrar, esconder, aplaudir, susurrar, hipnotizar, arquitecto, fontanero, electricista, veterinario, fotógrafo, jardinero, mago, detective, director de orquesta, socorrista, carpintero, científico, malabarista'),
    ],
  },
  lazer: {
    nome: 'Deporte y ocio',
    n: [
      L('fútbol, bicicleta, globo, piscina, columpio, tobogán, monopatín, patines, raqueta, gol, medalla, trofeo, dado, piano, tambor, guitarra, silbato, tenis, pelota de playa, regalo'),
      L('baloncesto, voleibol, surf, ajedrez, kárate, gimnasia, bolos, acampada, tienda de campaña, cama elástica, puzle, yoyó, peonza, canicas, comba, golf, esquí, canoa, cometa, violín'),
      L('paracaídas, ala delta, montaña rusa, tiovivo, noria, maratón, escalada, hockey, balonmano, arco y flecha, ping-pong, futbolín, billar, dardos, salto con pértiga, judo, rugby, buceo, kayak, fuegos artificiales'),
    ],
  },
};
