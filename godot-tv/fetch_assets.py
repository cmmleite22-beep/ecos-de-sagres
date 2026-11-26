#!/usr/bin/env python3
"""Descarrega texturas fotográficas CC0 do Poly Haven (polyhaven.com) para assets/polyhaven/.
Para cada "slot" tenta vários materiais por ordem; o primeiro que existir fica. Se a rede falhar,
o jogo usa texturas procedurais — por isso este passo nunca faz falhar a compilação."""
import json, os, sys, urllib.request

SLOTS = {
    'stone':  ['castle_wall_slates', 'medieval_blocks_02', 'stone_wall', 'rock_wall_08', 'castle_brick_07'],
    'rock':   ['rock_face', 'aerial_rocks_02', 'rock_wall_10', 'rocks_ground_02', 'rock_boulder_dry'],
    'sand':   ['coast_sand_01', 'aerial_beach_01', 'sand_01', 'coast_sand_rocks_02'],
    'grass':  ['forrest_ground_01', 'forest_leaves_02', 'aerial_grass_rock', 'leafy_grass'],
    'dirt':   ['brown_mud_leaves_01', 'forest_ground_04', 'dirt_floor', 'brown_mud_02'],
    'wood':   ['brown_planks_03', 'wood_planks', 'old_planks_02', 'weathered_planks'],
    'bark':   ['bark_brown_02', 'bark_willow_02', 'pine_bark', 'bark_brown_01'],
    'carved': ['carved_stone_wall', 'medieval_wall_01', 'castle_brick_02_red', 'stone_brick_wall_001'],
}
MAPS = {'diff': ['diffuse', 'diff', 'albedo', 'col'], 'nor_gl': ['nor_gl'], 'rough': ['rough', 'roughness']}
RES = os.environ.get('PH_RES', '1k')
UA = {'User-Agent': 'ecos-de-sagres-build/1.0'}
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, 'assets', 'polyhaven')
os.makedirs(out, exist_ok=True)

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()

def pick(files, names):
    for k, v in files.items():
        if k.lower() in names and isinstance(v, dict) and RES in v:
            fmt = v[RES]
            for ext in ('jpg', 'png'):
                if ext in fmt:
                    return fmt[ext]['url'], ext
    return None, None

credits = []
for slot, slugs in SLOTS.items():
    for slug in slugs:
        try:
            files = json.loads(get(f'https://api.polyhaven.com/files/{slug}'))
        except Exception as e:
            print(f'  {slot}: {slug} indisponível ({e})')
            continue
        url, ext = pick(files, MAPS['diff'])
        if not url:
            print(f'  {slot}: {slug} sem mapa de cor {RES}')
            continue
        ok = True
        for m, names in MAPS.items():
            u, e = pick(files, names)
            if not u:
                continue
            try:
                data = get(u)
                open(os.path.join(out, f'{slot}_{m}.{e}'), 'wb').write(data)
            except Exception as ex:
                print(f'  {slot}: falhou {m} ({ex})')
                if m == 'diff':
                    ok = False
        if ok:
            print(f'{slot}: {slug}')
            credits.append(f'{slot}: https://polyhaven.com/a/{slug} (CC0)')
            break
open(os.path.join(out, 'CREDITOS.txt'), 'w').write('Texturas: Poly Haven (CC0)\n' + '\n'.join(credits) + '\n')
print(f'{len(credits)}/{len(SLOTS)} texturas fotográficas')
