// Words in English. Each theme has three levels: easy, medium, hard (20 words each).
const L = (s) => s.split(',').map((w) => w.trim()).filter(Boolean);

export default {
  animais: {
    nome: 'Animals',
    n: [
      L('cat, dog, fish, bird, cow, pig, horse, chicken, rabbit, mouse, snake, frog, duck, sheep, spider, butterfly, snail, turtle, whale, elephant'),
      L('giraffe, octopus, dolphin, shark, owl, bat, bee, ant, ladybird, lion, monkey, penguin, camel, crocodile, zebra, kangaroo, crab, donkey, lizard, flamingo'),
      L('chameleon, seahorse, hedgehog, starfish, jellyfish, parrot, peacock, rhinoceros, hippopotamus, otter, squirrel, mole, squid, woodpecker, ostrich, centipede, scorpion, walrus, sloth, platypus'),
    ],
  },
  comida: {
    nome: 'Food',
    n: [
      L('apple, banana, bread, egg, cheese, cake, ice cream, pizza, orange, grapes, carrot, strawberry, milk, soup, potato, tomato, pear, cherry, chocolate, sweet'),
      L('pineapple, watermelon, hamburger, spaghetti, sandwich, hot dog, popcorn, biscuit, yoghurt, mushroom, lemon, corn, garlic, onion, pepper, peas, sausage, pancake, juice, toast'),
      L('fish and chips, doughnut, cupcake, pretzel, burrito, taco, sushi, omelette, kebab, lollipop, cookie, waffle, croissant, olive, chestnut, broccoli, avocado, candyfloss, milkshake, birthday cake'),
    ],
  },
  casa: {
    nome: 'Home and objects',
    n: [
      L('house, chair, table, bed, door, window, book, pencil, key, glass, bottle, clock, glasses, shoe, hat, ball, umbrella, phone, light bulb, scissors'),
      L('fridge, sofa, television, toothbrush, pillow, mirror, candle, backpack, computer, lamp, ladder, hammer, fork, spoon, pan, bucket, soap, toaster, hairdryer, coat hanger'),
      L('washing machine, vacuum cleaner, microwave, fan, remote control, iron, alarm clock, stapler, thermometer, calculator, corkscrew, clothesline, kettle, ruler, headphones, charger, blinds, fireplace, safe, padlock'),
    ],
  },
  natureza: {
    nome: 'Nature and places',
    n: [
      L('sun, moon, star, tree, flower, cloud, rain, sea, mountain, beach, river, snow, fire, rainbow, leaf, stone, island, wave, volcano, lightning'),
      L('waterfall, desert, forest, lake, cave, lighthouse, bridge, castle, church, school, hospital, park, garden, farm, city, tornado, cactus, palm tree, thunderstorm, vegetable patch'),
      L('archipelago, eclipse, crater, fog, dew, tide, glacier, viewpoint, airport, station, library, museum, pharmacy, roundabout, traffic light, zebra crossing, windmill, swamp, geyser, iceberg'),
    ],
  },
  acoes: {
    nome: 'Actions and jobs',
    n: [
      L('run, jump, sleep, eat, swim, cry, laugh, dance, sing, read, write, drink, fly, paint, doctor, firefighter, police officer, teacher, cook, fisherman'),
      L('fishing, cooking, sneeze, yawn, whistle, dive, slide, push, hug, wave, postman, painter, farmer, pilot, dentist, mechanic, astronaut, hairdresser, clown, nurse'),
      L('trip, snore, balance, hide, clap, whisper, hypnotise, architect, plumber, electrician, vet, photographer, gardener, magician, detective, conductor, lifeguard, carpenter, scientist, juggler'),
    ],
  },
  lazer: {
    nome: 'Sport and fun',
    n: [
      L('football, bicycle, balloon, swimming pool, swing, slide, skateboard, roller skates, racket, goal, medal, trophy, dice, piano, drum, guitar, whistle, tennis, beach ball, present'),
      L('basketball, volleyball, surfing, chess, karate, gymnastics, bowling, camping, tent, trampoline, puzzle, yo-yo, spinning top, marbles, skipping rope, golf, skiing, canoe, kite, violin'),
      L('parachute, hang glider, roller coaster, merry-go-round, ferris wheel, marathon, climbing, hockey, baseball, bow and arrow, table tennis, table football, snooker, darts, pole vault, judo, rugby, scuba diving, kayak, fireworks'),
    ],
  },
};
