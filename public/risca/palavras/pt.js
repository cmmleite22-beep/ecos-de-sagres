// Palavras em português de Portugal. Cada tema tem três níveis: fácil, médio, difícil (20 palavras cada).
const L = (s) => s.split(',').map((w) => w.trim()).filter(Boolean);

export default {
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
};
