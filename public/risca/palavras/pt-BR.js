// Palavras em português do Brasil. Cada tema tem três níveis: fácil, médio, difícil (20 palavras cada).
const L = (s) => s.split(',').map((w) => w.trim()).filter(Boolean);

export default {
  animais: {
    nome: 'Animais',
    n: [
      L('gato, cachorro, peixe, passarinho, vaca, porco, cavalo, galinha, coelho, rato, cobra, sapo, pato, ovelha, aranha, borboleta, caracol, tartaruga, baleia, elefante'),
      L('girafa, polvo, golfinho, tubarão, coruja, morcego, abelha, formiga, joaninha, leão, macaco, pinguim, camelo, jacaré, zebra, canguru, caranguejo, burro, lagartixa, flamingo'),
      L('camaleão, cavalo-marinho, ouriço, estrela-do-mar, água-viva, papagaio, pavão, rinoceronte, hipopótamo, lontra, esquilo, tamanduá, lula, pica-pau, avestruz, centopeia, escorpião, morsa, bicho-preguiça, tucano'),
    ],
  },
  comida: {
    nome: 'Comida',
    n: [
      L('maçã, banana, pão, ovo, queijo, bolo, sorvete, pizza, laranja, uva, cenoura, morango, leite, sopa, batata, tomate, pera, cereja, chocolate, bala'),
      L('abacaxi, melancia, hambúrguer, espaguete, sanduíche, cachorro-quente, pipoca, biscoito, iogurte, cogumelo, limão, milho, alho, cebola, pimentão, ervilha, salsicha, panqueca, suco, torrada'),
      L('pão de queijo, brigadeiro, coxinha, feijoada, pastel, açaí, tapioca, farofa, pudim, sushi, omelete, churrasco, quindim, acarajé, moqueca, azeitona, castanha, paçoca, algodão-doce, pirulito'),
    ],
  },
  casa: {
    nome: 'Casa e objetos',
    n: [
      L('casa, cadeira, mesa, cama, porta, janela, livro, lápis, chave, copo, garrafa, relógio, óculos, sapato, chapéu, bola, guarda-chuva, celular, lâmpada, tesoura'),
      L('geladeira, sofá, televisão, escova de dentes, travesseiro, espelho, vela, mochila, computador, abajur, escada, martelo, garfo, colher, panela, balde, sabonete, torradeira, secador, cabide'),
      L('máquina de lavar, aspirador, micro-ondas, ventilador, controle remoto, ferro de passar, despertador, grampeador, termômetro, calculadora, saca-rolhas, varal, chaleira, régua, fone de ouvido, carregador, persiana, lareira, cofre, cadeado'),
    ],
  },
  natureza: {
    nome: 'Natureza e lugares',
    n: [
      L('sol, lua, estrela, árvore, flor, nuvem, chuva, mar, montanha, praia, rio, neve, fogo, arco-íris, folha, pedra, ilha, onda, vulcão, raio'),
      L('cachoeira, deserto, floresta, lago, caverna, farol, ponte, castelo, igreja, escola, hospital, parque, jardim, fazenda, cidade, tornado, cacto, palmeira, trovoada, horta'),
      L('arquipélago, eclipse, cratera, neblina, orvalho, maré, geleira, mirante, aeroporto, estação, biblioteca, museu, farmácia, rotatória, semáforo, faixa de pedestres, moinho, mangue, gêiser, iceberg'),
    ],
  },
  acoes: {
    nome: 'Ações e profissões',
    n: [
      L('correr, pular, dormir, comer, nadar, chorar, rir, dançar, cantar, ler, escrever, beber, voar, pintar, médico, bombeiro, policial, professor, cozinheiro, pescador'),
      L('pescar, cozinhar, espirrar, bocejar, assobiar, mergulhar, escorregar, empurrar, abraçar, acenar, carteiro, pintor, agricultor, piloto, dentista, mecânico, astronauta, cabeleireiro, palhaço, enfermeiro'),
      L('tropeçar, roncar, equilibrar, esconder, aplaudir, sussurrar, hipnotizar, arquiteto, encanador, eletricista, veterinário, fotógrafo, jardineiro, mágico, detetive, maestro, salva-vidas, carpinteiro, cientista, malabarista'),
    ],
  },
  lazer: {
    nome: 'Esporte e lazer',
    n: [
      L('futebol, bicicleta, balão, piscina, balanço, escorregador, skate, patins, raquete, gol, medalha, troféu, dado, piano, tambor, violão, apito, tênis, bola de praia, presente'),
      L('basquete, vôlei, surfe, xadrez, caratê, ginástica, boliche, acampamento, barraca, cama elástica, quebra-cabeça, ioiô, pião, bolinha de gude, corda, golfe, esqui, canoa, pipa, violino'),
      L('paraquedas, asa-delta, montanha-russa, carrossel, roda-gigante, maratona, escalada, hóquei, handebol, arco e flecha, pingue-pongue, pebolim, sinuca, tiro ao alvo, salto com vara, judô, rúgbi, mergulho, caiaque, fogos de artifício'),
    ],
  },
  brasil: {
    nome: 'Brasil',
    n: [
      L('praia, bandeira, futebol, coqueiro, papagaio, onça, arara, violão, tambor, sol, palmeira, bola, rede, sorvete, chinelo, banana, abacaxi, tartaruga, barco, ônibus'),
      L('samba, carnaval, capoeira, berimbau, pandeiro, cuíca, chimarrão, boto-cor-de-rosa, mico-leão-dourado, jangada, caipira, festa junina, quadrilha, fogueira, saci, cuca, sucuri, ipê, caju, guaraná'),
      L('cristo redentor, pão de açúcar, cataratas do iguaçu, floresta amazônica, pantanal, bumba meu boi, frevo, maracatu, escola de samba, sambódromo, bondinho, lençóis maranhenses, boitatá, curupira, mula sem cabeça, iara, vitória-régia, acarajé, feijoada, brigadeiro'),
    ],
  },
};
