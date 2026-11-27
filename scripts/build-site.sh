#!/usr/bin/env bash
# Monta o site estático em _site/ (GitHub Pages, Firebase Hosting e Cloudflare Pages usam o mesmo).
# Uso: npm ci && npm run build:site
set -e
rm -rf _site
mkdir -p _site/vendor/addons
cp -r public/* _site/
[ -d public/.well-known ] && cp -r public/.well-known _site/
cp node_modules/three/build/three.module.js _site/vendor/
cp -r node_modules/three/examples/jsm/* _site/vendor/addons/
cp node_modules/qrcode-generator/qrcode.js _site/vendor/
printf '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=controller/"><a href="controller/">Ecos de Sagres</a>' > _site/index.html
touch _site/.nojekyll
echo "site montado em _site/"
