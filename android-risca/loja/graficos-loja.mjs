import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const F = JSON.parse(fs.readFileSync('/home/claude/ecos-de-sagres/android-risca/loja/fichas.json', 'utf8'));
const N = { 'pt-PT': ['Risca','e','Arrisca'], 'pt-BR': ['Risca','e','Arrisca'], es: ['Pinta','y','Arriesga'], fr: ['Gribouille','et','Devine'], de: ['Kritzel','&amp;','Rate'], 'zh-CN': ['画画','·','猜猜'] };
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 500 } });
const base = fs.readFileSync('grafico.html', 'utf8').replace('family=Permanent+Marker', 'family=Permanent+Marker&family=ZCOOL+KuaiLe').replace(/font-family:"Permanent Marker"/g, 'font-family:"Permanent Marker","ZCOOL KuaiLe"').replace('font-family:"Patrick Hand"', 'font-family:"Patrick Hand","ZCOOL KuaiLe"');
for (const [L, [r, e, a]] of Object.entries(N)) {
  const big = (r + a).length > 14 ? 'style="font-size:74px"' : '';
  const html = base.replace(/<h1>.*<\/h1>/, `<h1 ${big}><span class="r">${r}</span> <span class="e">${e}</span><br><span class="a">${a}</span></h1>`).replace(/<p>.*<\/p>/, `<p ${F[L].grafico.length > 38 ? "style=\"font-size:29px\"" : ""}>${F[L].grafico}</p>`);
  fs.writeFileSync('g-tmp.html', html);
  await p.goto('file://' + process.cwd() + '/g-tmp.html'); await p.waitForTimeout(1500); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${L}/feature-graphic-1024x500.png` });
}
await b.close();
