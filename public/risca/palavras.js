// Risca e Arrisca — listas de palavras (português de Portugal) e comparação de palpites.
// Cada tema tem três níveis: 1 = fácil, 2 = médio, 3 = difícil. Quem desenha escolhe entre uma de cada.
const L = (s) => s.split(',').map((w) => w.trim()).filter(Boolean);

export const TEMAS = {
  animais: {
    nome: 'Animais',
    n: [
      L('gato, cão, peixe, pássaro, vaca, porco, cavalo, galinha, coelho, rato, cobra, sapo, pato, ovelha, aranha, borboleta, caracol, tartaruga, baleia, elefante'),
      L('girafa, polvo, golfinho, tubarão, coruja, morcego, abelha, formiga, joaninha, leão, macaco, pinguim, camelo, crocodilo, zebra, canguru, caranguejo, burro, lagarto, flamingo'),
      L('camaleão, cavalo-marinho, ouriço, estrela-do-mar, medusa, papagaio, pavão, rinoceronte, hipopótamo, lontra, esquilo, toupeira, lula, pica-pau, avestruz, centopeia, escorpião, morsa, cagarro, mocho'),
    ],
  },
  comida: {
    nome: 'Comida',
    n: [
      L('maçã, banana, pão, ovo, queijo, bolo, gelado, pizza, laranja, uvas, cenoura, morango, leite, sopa, batata, tomate, pera, cereja, chocolate, rebuçado'),
      L('ananás, melancia, hambúrguer, esparguete, sanduíche, cachorro-quente, pipocas, bolacha, iogurte, cogumelo, limão, milho, alho, cebola, pimento, ervilhas, salsicha, panqueca, sumo, torrada'),
      L('pastel de nata, malassada, bolo-rei, francesinha, arroz-doce, caldo verde, bitoque, sushi, omelete, espetada, queijada, bacalhau, pudim, azeitona, castanha, tremoço, lapas, alcatra, algodão-doce, chupa-chupa'),
    ],
  },
  casa: {
    nome: 'Casa e objetos',
    n: [
      L('casa, cadeira, mesa, cama, porta, janela, livro, lápis, chave, copo, garrafa, relógio, óculos, sapato, chapéu, bola, guarda-chuva, telemóvel, lâmpada, tesoura'),
      L('frigorífico, sofá, televisão, escova de dentes, almofada, espelho, vela, mochila, computador, candeeiro, escada, martelo, garfo, colher, panela, balde, sabonete, torradeira, secador, cabide'),
      L('máquina de lavar, aspirador, micro-ondas, ventoinha, comando, ferro de engomar, despertador, agrafador, termómetro, calculadora, saca-rolhas, estendal, chaleira, régua, auscultadores, carregador, persiana, lareira, cofre, cadeado'),
    ],
  },
  natureza: {
    nome: 'Natureza e lugares',
    n: [
      L('sol, lua, estrela, árvore, flor, nuvem, chuva, mar, montanha, praia, rio, neve, fogo, arco-íris, folha, pedra, ilha, onda, vulcão, relâmpago'),
      L('cascata, deserto, floresta, lago, gruta, farol, ponte, castelo, igreja, escola, hospital, parque, jardim, quinta, cidade, tornado, cato, palmeira, trovoada, horta'),
      L('arquipélago, eclipse, cratera, nevoeiro, orvalho, maré, glaciar, miradouro, aeroporto, estação, biblioteca, museu, farmácia, rotunda, semáforo, passadeira, moinho, caldeira, géiser, iceberg'),
    ],
  },
  acoes: {
    nome: 'Ações e profissões',
    n: [
      L('correr, saltar, dormir, comer, nadar, chorar, rir, dançar, cantar, ler, escrever, beber, voar, pintar, médico, bombeiro, polícia, professor, cozinheiro, pescador'),
      L('pescar, cozinhar, espirrar, bocejar, assobiar, mergulhar, escorregar, empurrar, abraçar, acenar, carteiro, pintor, agricultor, piloto, dentista, mecânico, astronauta, cabeleireiro, palhaço, enfermeiro'),
      L('tropeçar, ressonar, equilibrar, esconder, aplaudir, sussurrar, hipnotizar, arquiteto, canalizador, eletricista, veterinário, fotógrafo, jardineiro, mágico, detetive, maestro, nadador-salvador, carpinteiro, cientista, malabarista'),
    ],
  },
  lazer: {
    nome: 'Desporto e lazer',
    n: [
      L('futebol, bicicleta, balão, piscina, baloiço, escorrega, skate, patins, raquete, golo, medalha, taça, dado, piano, tambor, guitarra, apito, ténis, bola de praia, prenda'),
      L('basquetebol, voleibol, surf, xadrez, karaté, ginástica, bowling, campismo, tenda, trampolim, puzzle, ioiô, pião, berlinde, corda, golfe, esqui, canoa, papagaio de papel, violino'),
      L('paraquedas, asa-delta, montanha-russa, carrossel, roda-gigante, maratona, escalada, hóquei, andebol, arco e flecha, pingue-pongue, matraquilhos, bilhar, tiro ao alvo, salto à vara, judo, râguebi, mergulho, caiaque, fogo de artifício'),
    ],
  },
  portugal: {
    nome: 'Portugal e Açores',
    n: [
      L('barco, bandeira, sardinha, galo, elétrico, chouriço, azulejo, vaca, hortênsia, baleia, farol, ananás, castelo, vulcão, ilha, guitarra, onda, golfinho, cavala, pastel de nata'),
      L('caravela, cagarro, lagoa, chá, bolo lêvedo, filarmónica, romaria, fado, cortiça, pastor, espigueiro, calçada, galo de barcelos, moinho, vinha, queijo da ilha, lapas, malassada, rendas, cachecol'),
      L('torre de belém, ponte 25 de abril, sete cidades, cozido das furnas, tourada à corda, coroa do espírito santo, bote baleeiro, vigia da baleia, padrão dos descobrimentos, império, alcatra, caldeira, gruta do natal, santo antónio, marchas populares, bacalhau, francesinha, manjerico, sardinha assada, tremoços'),
    ],
  },
  ingles: {
    nome: 'Inglês (English)',
    fora: true, // não entra no "Tudo misturado"
    n: [
      L('cat, dog, fish, bird, sun, moon, tree, house, car, ball, apple, banana, book, chair, table, hat, shoe, cake, star, flower'),
      L('rabbit, horse, elephant, bicycle, umbrella, rainbow, pencil, window, kitchen, teacher, sandwich, butterfly, mountain, island, bridge, castle, rocket, guitar, snowman, spider'),
      L('lighthouse, volcano, astronaut, skateboard, toothbrush, wheelchair, fireworks, waterfall, scarecrow, backpack, headphones, sunglasses, dinosaur, octopus, penguin, jellyfish, treasure, campfire, library, ladder'),
    ],
  },
};
const MISTO = Object.values(TEMAS).filter((t) => !t.fora);

export const TEMA_LISTA = [['misto', 'Tudo misturado'], ...Object.entries(TEMAS).map(([k, t]) => [k, t.nome]), ['nossas', 'As nossas palavras']];
export const NIVEL = [null, { nome: 'fácil', mult: 1 }, { nome: 'média', mult: 1.3 }, { nome: 'difícil', mult: 1.6 }];

// Lê a lista de palavras próprias escrita no telemóvel (separadas por vírgulas ou linhas).
export function parseCustom(text) {
  const seen = new Set();
  return String(text || '').split(/[,;\n]+/).map((w) => w.trim().replace(/\s+/g, ' ').slice(0, 30))
    .filter((w) => w.length >= 2 && !seen.has(norm(w)) && seen.add(norm(w))).slice(0, 200);
}

// Escolhe 3 palavras (fácil, média, difícil) ainda não usadas neste jogo.
export function escolher(theme, custom, used, rnd = Math.random) {
  const pick = (arr) => {
    const free = arr.filter((w) => !used.has(norm(w)));
    const pool = free.length ? free : arr;
    return pool[Math.floor(rnd() * pool.length)];
  };
  if (theme === 'nossas' && custom?.length >= 3) {
    const out = [];
    const left = custom.filter((w) => !used.has(norm(w)));
    const pool = left.length >= 3 ? left.slice() : custom.slice();
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out.map((w) => ({ w, lvl: 2 }));
  }
  const temas = TEMAS[theme] ? [TEMAS[theme]] : MISTO;
  const out = [];
  for (let lvl = 1; lvl <= 3; lvl++) {
    let w, tries = 0;
    do {
      const t = temas[Math.floor(rnd() * temas.length)];
      w = pick(t.n[lvl - 1]);
    } while (out.some((o) => norm(o.w) === norm(w)) && ++tries < 20);
    out.push({ w, lvl });
  }
  return out;
}

// Várias palavras diferentes de uma vez (fáceis e médias), para o "Passa o Risco".
export function escolherVarias(theme, custom, n, used, rnd = Math.random) {
  const pool = theme === 'nossas' && custom?.length >= 3 ? custom.slice()
    : (TEMAS[theme] ? [TEMAS[theme]] : MISTO).flatMap((t) => [...t.n[0], ...t.n[1]]);
  let free = pool.filter((w) => !used.has(norm(w)));
  if (free.length < n) free = pool.slice();
  const out = [];
  while (out.length < n) {
    if (!free.length) free = pool.slice();
    out.push(free.splice(Math.floor(rnd() * free.length), 1)[0]);
  }
  return out;
}

// Opções para o modo dos mais novos: a palavra certa e mais 3 do mesmo tema, baralhadas.
export function opcoes(theme, custom, word, rnd = Math.random) {
  const all = (ts) => ts.flatMap((t) => t.n.flat());
  let pool = theme === 'nossas' && custom?.length ? custom.slice() : TEMAS[theme] ? all([TEMAS[theme]]) : all(MISTO);
  pool = pool.filter((w) => norm(w) !== norm(word));
  const extra = (TEMAS[theme]?.fora ? all([TEMAS[theme]]) : all(MISTO)).filter((w) => norm(w) !== norm(word));
  const out = [];
  for (let k = 0; out.length < 3 && k < 60; k++) {
    const src = pool.length ? pool : extra;
    const w = src.splice(Math.floor(rnd() * src.length), 1)[0];
    if (w && !out.some((o) => norm(o) === norm(w))) out.push(w);
  }
  out.splice(Math.floor(rnd() * 4), 0, word);
  return out;
}

// ---------------- comparar palpites ----------------
// Ignora maiúsculas, acentos, hífenes e artigos no início ("o gato" = "gato" = "Gáto").
export function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(o|a|os|as|um|uma|uns|umas) (?=\S)/, '');
}
export function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
// 'yes' = acertou; 'close' = quase (uma letra trocada, ou duas em palavras compridas); 'no'
export function comparar(palpite, palavra) {
  const a = norm(palpite), b = norm(palavra);
  if (!a) return 'no';
  if (a === b || a.replace(/ /g, '') === b.replace(/ /g, '')) return 'yes';
  if (b.length >= 4) {
    const d = distancia(a, b);
    if (d <= (b.length >= 8 ? 2 : 1)) return 'close';
  }
  return 'no';
}

// Padrão para mostrar: letras escondidas como '_' (espaços e hífenes ficam à vista).
export function padrao(palavra, reveladas) {
  return [...palavra].map((ch, i) => (/[\p{L}\p{N}]/u.test(ch) && !reveladas.has(i) ? '_' : ch)).join('');
}
