#!/usr/bin/env node
/**
 * generate-radar.js
 *
 * Renders a polygon radar/spider chart as SVG from a simple JSON file:
 *   { "title": "Skill Radar", "data": { "JavaScript": 100, "TypeScript": 70, ... } }
 * Values are 0-100. 3-8 axes look best.
 *
 * Usage: node scripts/generate-radar.js input.json output.svg
 */
const fs = require('fs');
const path = require('path');

function buildRadarSVG(title, data, opts = {}) {
  const labels = Object.keys(data);
  const values = Object.values(data);
  const n = labels.length;
  const W = opts.width || 360, H = opts.height || 360;
  const cx = W / 2, cy = H / 2 + 6;
  const R = Math.min(W, H) / 2 - 60;
  const rings = 4;
  const color = opts.color || '#39d353';
  const bg = opts.bg || '#0d1117';
  const grid = opts.grid || '#21262d';

  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, frac) => {
    const a = angle(i);
    return [cx + Math.cos(a) * R * frac, cy + Math.sin(a) * R * frac];
  };

  let gridSvg = '';
  for (let ring = 1; ring <= rings; ring++) {
    const frac = ring / rings;
    const poly = Array.from({ length: n }, (_, i) => pt(i, frac).join(',')).join(' ');
    gridSvg += `<polygon points="${poly}" fill="none" stroke="${grid}" stroke-width="1"/>`;
  }
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, 1);
    gridSvg += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${grid}" stroke-width="1"/>`;
  }

  const dataPoly = values
    .map((v, i) => pt(i, Math.max(0.04, v / 100)).join(','))
    .join(' ');

  let labelSvg = '';
  labels.forEach((label, i) => {
    const [x, y] = pt(i, 1.18);
    const anchor = Math.abs(Math.cos(angle(i))) < 0.2 ? 'middle' : Math.cos(angle(i)) > 0 ? 'start' : 'end';
    labelSvg += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-family="Menlo,Consolas,monospace" font-size="11" fill="#c9d1d9">${label}</text>`;
    if (opts.showValues) {
      labelSvg += `<text x="${x.toFixed(1)}" y="${(y + 12).toFixed(1)}" text-anchor="${anchor}" font-family="Menlo,Consolas,monospace" font-size="9" fill="#6e7681">${values[i]}</text>`;
    }
  });

  const dots = values
    .map((v, i) => {
      const [x, y] = pt(i, Math.max(0.04, v / 100));
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}"/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <text x="${W / 2}" y="24" text-anchor="middle" font-family="Menlo,Consolas,monospace" font-size="13" font-weight="700" fill="#e6edf3">${title}</text>
  ${gridSvg}
  <polygon points="${dataPoly}" fill="${color}22" stroke="${color}" stroke-width="2"/>
  ${dots}
  ${labelSvg}
</svg>`;
}

if (require.main === module) {
  const inPath = process.argv[2];
  const outPath = process.argv[3];
  if (!inPath || !outPath) {
    console.error('Usage: node generate-radar.js input.json output.svg');
    process.exit(1);
  }
  const { title, data, ...opts } = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const svg = buildRadarSVG(title, data, opts);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg);
  console.log(`Wrote ${outPath}`);
}

module.exports = { buildRadarSVG };
