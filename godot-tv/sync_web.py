#!/usr/bin/env python3
"""Embute o comando do telemóvel (public/controller + public/shared) num script GDScript.
Assim a app da TV serve exatamente os mesmos ficheiros que a versão web, sem depender
de como o Godot exporta ficheiros que não são recursos. Corre antes de abrir/exportar."""
import base64, os
here = os.path.dirname(os.path.abspath(__file__))
pub = os.path.join(here, '..', 'public')
out = ['# GERADO por sync_web.py a partir de public/ — não editar à mão.', 'class_name WebAssets', 'extends RefCounted', '', 'const FILES := {']
for sub in ('controller', 'shared'):
    for root, _, files in os.walk(os.path.join(pub, sub)):
        for f in sorted(files):
            full = os.path.join(root, f)
            rel = '/' + os.path.relpath(full, pub).replace(os.sep, '/')
            data = base64.b64encode(open(full, 'rb').read()).decode()
            out.append(f'\t"{rel}": "{data}",')
out.append('}')
out.append('')
out.append('static func get_file(path: String):')
out.append('\tif not FILES.has(path):')
out.append('\t\treturn null')
out.append('\treturn Marshalls.base64_to_raw(FILES[path])')
open(os.path.join(here, 'scripts', 'web_assets.gd'), 'w').write('\n'.join(out) + '\n')
print('scripts/web_assets.gd atualizado')
