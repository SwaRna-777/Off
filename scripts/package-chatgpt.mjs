import { readFile, writeFile } from 'node:fs/promises';

const script = (await readFile(new URL('../dist-chatgpt/widget.js', import.meta.url), 'utf8')).replace(/<\/script/gi, '<\\/script');
const css = (await readFile(new URL('../dist-chatgpt/offline-ats-resume-builder.css', import.meta.url), 'utf8')).replace(/<\/style/gi, '<\\/style');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Folio Resume Studio</title><style>${css}</style></head><body><div id="root"></div><script>${script}</script></body></html>`;
await writeFile(new URL('../dist-chatgpt/widget.html', import.meta.url), html);
console.log(`Packaged self-contained ChatGPT editor (${Math.round(Buffer.byteLength(html) / 1024)} KB).`);
