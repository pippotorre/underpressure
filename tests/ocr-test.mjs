// Test del riconoscimento sulle foto di esempio del display.
// Uso: npm i jpeg-js && node tests/ocr-test.mjs <cartella-foto>
// I nomi dei file indicano il risultato atteso, per esempio:
//   p2_133_89_59.jpg  -> profilo 2, 133/89, polso 59
//   p4_174_incompleta.jpg -> misura incompleta del profilo 4
//   nonleggibile_*.jpg -> deve fallire
import fs from 'fs'; import path from 'path'; import jpeg from 'jpeg-js';
import { recognize } from '../underpressure/js/ocr.js';

const dir = process.argv[2];
if (!dir) { console.error('Indica la cartella con le foto'); process.exit(1); }
const files = fs.readdirSync(dir).filter(f => /\.(jpe?g)$/i.test(f)).sort();
let good = 0;
for (const f of files) {
  const m = f.match(/^p(\d)_(\d+)_(\d+)_(\d+)/), inc = f.match(/^p(\d)_\d+_incompleta/);
  const expected = m ? `${m[2]}/${m[3]}/${m[4]} p${m[1]}` : inc ? `inc p${inc[1]}` : 'fail';
  const img = jpeg.decode(fs.readFileSync(path.join(dir, f)), { useTArray: true, maxMemoryUsageInMB: 1024 });
  const r = recognize(img);
  const got = r.ok ? `${r.sys}/${r.dia}/${r.pul} p${r.profile}` : r.error === 'incomplete' ? `inc p${r.profile}` : 'fail';
  const ok = got === expected; if (ok) good++;
  console.log(ok ? 'OK ' : 'XX ', f.padEnd(34), expected.padEnd(16), '=>', got, r.ok ? '' : `(${r.error})`);
}
console.log(`${good}/${files.length} corrette`);
process.exit(good === files.length ? 0 : 1);
