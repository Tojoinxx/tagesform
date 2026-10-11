import * as esbuild from 'esbuild';
import fs from 'node:fs';
const v = '1.0.0-' + new Date().toISOString().replace(/\D/g, '').slice(0, 12);
fs.rmSync('web/js', { recursive: true, force: true });
await esbuild.build({
  entryPoints: ['src/main.jsx'],
  bundle: true, splitting: true, format: 'esm', outdir: 'web/js',
  jsx: 'automatic', jsxImportSource: 'preact',
  minify: true, target: ['es2020', 'safari15'],
  chunkNames: 'c-[hash]', legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const html = fs.readFileSync('src/index.html', 'utf8').replaceAll('__V__', v);
fs.writeFileSync('web/index.html', html);
const chunks = fs.readdirSync('web/js').map((f) => './js/' + f);
const sw = fs.readFileSync('src/sw.js', 'utf8').replace('__V__', v).replace('__CHUNKS__', JSON.stringify(chunks));
fs.writeFileSync('web/sw.js', sw);
const size = fs.readdirSync('web/js').map((f) => [f, fs.statSync('web/js/' + f).size]);
console.log(v, size.map(([f, s]) => `${f} ${(s / 1024).toFixed(0)}k`).join(', '));
