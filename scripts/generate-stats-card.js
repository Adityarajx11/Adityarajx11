#!/usr/bin/env node
/**
 * generate-stats-card.js
 *
 * Fetches profile stats (stars, repos, followers, streak, top languages)
 * via GitHub's GraphQL API and renders a dark "at a glance" SVG card.
 *
 * Env vars required: GITHUB_TOKEN, GITHUB_USER
 * Usage: node scripts/generate-stats-card.js dist/stats.svg
 */
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN;
const USER = process.env.GITHUB_USER;
const outPath = process.argv[2] || 'dist/stats.svg';

if (!TOKEN || !USER) {
  console.error('Set GITHUB_TOKEN and GITHUB_USER env vars first.');
  process.exit(1);
}

const query = `
query($login: String!) {
  user(login: $login) {
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      totalCount
      nodes { stargazerCount primaryLanguage { name color } }
    }
    followers { totalCount }
    contributionsCollection {
      contributionCalendar { totalContributions }
    }
  }
}`;

function computeStreaks(user) {
  // simplified: GraphQL calendar gives totals only here; for full streak
  // detail you'd request contributionCalendar.weeks like in fetch-contributions.js
  return null;
}

async function main() {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));

  const u = json.data.user;
  const totalStars = u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);
  const totalRepos = u.repositories.totalCount;
  const followers = u.followers.totalCount;
  const contributions = u.contributionsCollection.contributionCalendar.totalContributions;

  const langBytes = {};
  for (const r of u.repositories.nodes) {
    if (!r.primaryLanguage) continue;
    const { name, color } = r.primaryLanguage;
    langBytes[name] = langBytes[name] || { count: 0, color: color || '#8b949e' };
    langBytes[name].count += 1;
  }
  const langs = Object.entries(langBytes)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);
  const langTotal = langs.reduce((s, [, v]) => s + v.count, 0) || 1;

  const W = 480, H = 260, PAD = 24;
  const stat = (label, value, x, y) => `
    <text x="${x}" y="${y}" font-family="Menlo,Consolas,monospace" font-size="26" font-weight="700" fill="#e6edf3">${value}</text>
    <text x="${x}" y="${y + 18}" font-family="Menlo,Consolas,monospace" font-size="11" fill="#8b949e">${label}</text>`;

  let bar = '';
  let bx = PAD;
  const barW = W - PAD * 2, barY = H - 46, barH = 8;
  for (const [, v] of langs) {
    const segW = (v.count / langTotal) * barW;
    bar += `<rect x="${bx.toFixed(1)}" y="${barY}" width="${segW.toFixed(1)}" height="${barH}" fill="${v.color}"/>`;
    bx += segW;
  }
  let legend = '';
  langs.forEach(([name, v], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = PAD + col * 220, ly = barY + 26 + row * 18;
    legend += `<circle cx="${lx}" cy="${ly - 4}" r="4" fill="${v.color}"/>
    <text x="${lx + 10}" y="${ly}" font-family="Menlo,Consolas,monospace" font-size="11" fill="#c9d1d9">${name}</text>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${USER} stats">
  <rect width="${W}" height="${H}" rx="10" fill="#0d1117" stroke="#30363d"/>
  <text x="${PAD}" y="34" font-family="Menlo,Consolas,monospace" font-size="15" fill="#39d353" font-weight="700">${USER}</text>
  <text x="${W - PAD}" y="34" text-anchor="end" font-family="Menlo,Consolas,monospace" font-size="11" fill="#8b949e">at a glance</text>
  <line x1="${PAD}" y1="44" x2="${W - PAD}" y2="44" stroke="#21262d"/>
  ${stat('Total stars', totalStars, PAD, 90)}
  ${stat('Public repos', totalRepos, PAD + 155, 90)}
  ${stat('Followers', followers, PAD + 310, 90)}
  ${stat('Contributions (1y)', contributions, PAD, 140)}
  <line x1="${PAD}" y1="${barY - 20}" x2="${W - PAD}" y2="${barY - 20}" stroke="#21262d"/>
  ${bar}
  ${legend}
</svg>`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg);
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
