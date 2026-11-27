// Risca e Arrisca — listas de palavras em várias línguas e comparação de palpites.
// As palavras de cada língua estão em palavras/<língua>.js. Cada tema tem três níveis: 1 = fácil, 2 = médio, 3 = difícil.
// Quem desenha escolhe entre uma de cada. Os conjuntos de palavras criados no telemóvel chegam em `custom`:
//   - num tema que já existe juntam-se às palavras desse tema;
//   - no tema 'propria' (uma categoria criada no telemóvel) são as únicas palavras.
import pt from './palavras/pt.js';
import ptBR from './palavras/pt-BR.js';
import en from './palavras/en.js';
import es from './palavras/es.js';
import fr from './palavras/fr.js';
import de from './palavras/de.js';
import zh from './palavras/zh.js';

export const PALAVRAS = { pt, 'pt-BR': ptBR, en, es, fr, de, zh };
export const temasDe = (lang) => PALAVRAS[lang] || pt;
// temas da língua: [chave, nome]
export const temaLista = (lang) => Object.entries(temasDe(lang)).map(([k, t]) => [k, t.nome]);
export const temaValido = (lang, theme) => theme === 'misto' || theme === 'propria' || !!temasDe(lang)[theme];
export const NIVEL = [null, { mult: 1 }, { mult: 1.3 }, { mult: 1.6 }];

// palavras de cada nível (1..3) para o tema escolhido
function niveis(lang, theme, custom) {
  const T = temasDe(lang);
  if (theme === 'propria' && custom?.length >= 3) return [custom, custom, custom];
  const temas = T[theme] ? [T[theme]] : Object.values(T);
  const extra = T[theme] && custom?.length ? custom : [];
  return [0, 1, 2].map((i) => [...temas.flatMap((t) => t.n[i]), ...extra]);
}

// Lê a lista de palavras próprias escrita no telemóvel (separadas por vírgulas ou linhas).
export function parseCustom(text) {
  const seen = new Set();
  return String(text || '').split(/[,;\n]+/).map((w) => w.trim().replace(/\s+/g, ' ').slice(0, 30))
    .filter((w) => (w.length >= 2 || /[\u3040-\u9fff\uac00-\ud7af]/.test(w)) && !seen.has(norm(w)) && seen.add(norm(w))).slice(0, 200);
}

// Escolhe 3 palavras (fácil, média, difícil) ainda não usadas neste jogo.
export function escolher(lang, theme, custom, used, rnd = Math.random) {
  const pick = (arr) => {
    const free = arr.filter((w) => !used.has(norm(w)));
    const pool = free.length ? free : arr;
    return pool[Math.floor(rnd() * pool.length)];
  };
  if (theme === 'propria' && custom?.length >= 3) {
    const out = [];
    const left = custom.filter((w) => !used.has(norm(w)));
    const pool = left.length >= 3 ? left.slice() : custom.slice();
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out.map((w) => ({ w, lvl: 2 }));
  }
  const lv = niveis(lang, theme, custom);
  const out = [];
  for (let lvl = 1; lvl <= 3; lvl++) {
    let w, tries = 0;
    do { w = pick(lv[lvl - 1]); } while (out.some((o) => norm(o.w) === norm(w)) && ++tries < 20);
    out.push({ w, lvl });
  }
  return out;
}

// Várias palavras diferentes de uma vez (fáceis e médias), para o "Passa o Risco".
export function escolherVarias(lang, theme, custom, n, used, rnd = Math.random) {
  const lv = niveis(lang, theme, custom);
  const pool = [...new Set([...lv[0], ...lv[1]])];
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
export function opcoes(lang, theme, custom, word, rnd = Math.random) {
  const pool = [...new Set(niveis(lang, theme, custom).flat())].filter((w) => norm(w) !== norm(word));
  const extra = [...new Set(niveis(lang, 'misto').flat())].filter((w) => norm(w) !== norm(word));
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
// Ignora maiúsculas, acentos, hífenes e artigos no início, em qualquer língua
// ("o gato" = "gato" = "Gáto"; "the cat" = "cat"; "die Katze" = "Katze"; "Käse" = "Kaese" = "Kase").
const ARTIGOS = /^(o|a|os|as|um|uma|uns|umas|the|an|el|la|los|las|un|unos|unas|le|les|l|des|une|der|die|das|den|dem|ein|eine|einen|einem|einer) (?=\S)/;
export function norm(s, umlaut) {
  let t = String(s || '').toLowerCase().replace(/ß/g, 'ss').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  if (umlaut) t = t.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
  return t.normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim()
    .replace(ARTIGOS, '');
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
  const same = (x, y) => x === y || x.replace(/ /g, '') === y.replace(/ /g, '');
  if (same(a, b) || same(norm(palpite, true), norm(palavra, true))) return 'yes';
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
