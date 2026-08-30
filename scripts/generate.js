// Fetches live GitHub data and renders self-hosted SVG cards into /assets.
// Runs from GitHub Actions on a schedule (see .github/workflows/update-assets.yml)
// so the README always shows fresh numbers without relying on third-party
// badge services that can go down or rate-limit.

const fs = require("fs");
const path = require("path");

const USERNAME = process.env.GH_USERNAME || "adixlucifer0011";
const TOKEN = process.env.GH_TOKEN;
const OUT_DIR = path.join(__dirname, "..", "assets");

if (!TOKEN) {
  console.error("Missing GH_TOKEN env var.");
  process.exit(1);
}

const QUERY = `
query($login: String!) {
  user(login: $login) {
    name
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      totalCount
      nodes {
        stargazerCount
        forkCount
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount date } }
      }
    }
  }
}`;

async function fetchData() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: QUERY, variables: { login: USERNAME } }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error(json.errors);
    process.exit(1);
  }
  return json.data.user;
}

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
  }[c]));
}

function buildStatsCard(user) {
  const totalStars = user.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);
  const totalForks = user.repositories.nodes.reduce((s, r) => s + r.forkCount, 0);
  const totalRepos = user.repositories.totalCount;
  const followers = user.followers.totalCount;
  const contributions = user.contributionsCollection.contributionCalendar.totalContributions;

  const rows = [
    ["Total Stars", totalStars],
    ["Total Forks", totalForks],
    ["Public Repos", totalRepos],
    ["Followers", followers],
    ["Contributions (1y)", contributions],
  ];

  const rowHeight = 34;
  const height = 60 + rows.length * rowHeight;

  const rowSvg = rows.map((r, i) => `
    <text x="25" y="${75 + i * rowHeight}" class="label">${escapeXml(r[0])}</text>
    <text x="330" y="${75 + i * rowHeight}" class="value" text-anchor="end">${r[1]}</text>
  `).join("");

  return `
<svg width="360" height="${height}" viewBox="0 0 360 ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .bg { fill: #0d1117; stroke: #30363d; stroke-width: 1; }
    .title { font: 600 16px 'Segoe UI', Arial, sans-serif; fill: #39FF14; }
    .label { font: 400 14px 'Segoe UI', Arial, sans-serif; fill: #c9d1d9; }
    .value { font: 600 14px 'Segoe UI', Arial, sans-serif; fill: #ffffff; }
  </style>
  <rect class="bg" x="0.5" y="0.5" width="359" height="${height - 1}" rx="10"/>
  <text x="25" y="35" class="title">${escapeXml(user.name || USERNAME)}'s GitHub Stats</text>
  ${rowSvg}
</svg>`.trim();
}

function buildLangsCard(user) {
  const totals = {};
  for (const repo of user.repositories.nodes) {
    for (const edge of repo.languages.edges) {
      const name = edge.node.name;
      totals[name] = totals[name] || { size: 0, color: edge.node.color || "#8b8b8b" };
      totals[name].size += edge.size;
    }
  }
  const sorted = Object.entries(totals).sort((a, b) => b[1].size - a[1].size).slice(0, 6);
  const grandTotal = sorted.reduce((s, [, v]) => s + v.size, 0) || 1;

  const barWidth = 310;
  let x = 25;
  const segments = sorted.map(([, v]) => {
    const w = (v.size / grandTotal) * barWidth;
    const seg = `<rect x="${x}" y="60" width="${w}" height="12" fill="${v.color}" />`;
    x += w;
    return seg;
  }).join("");

  const legend = sorted.map(([name, v], i) => {
    const pct = ((v.size / grandTotal) * 100).toFixed(1);
    const col = i % 2 === 0 ? 25 : 195;
    const row = 100 + Math.floor(i / 2) * 26;
    return `
      <circle cx="${col}" cy="${row - 5}" r="5" fill="${v.color}" />
      <text x="${col + 14}" y="${row}" class="legend">${escapeXml(name)} ${pct}%</text>
    `;
  }).join("");

  const height = 100 + Math.ceil(sorted.length / 2) * 26 + 15;

  return `
<svg width="360" height="${height}" viewBox="0 0 360 ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .bg { fill: #0d1117; stroke: #30363d; stroke-width: 1; }
    .title { font: 600 16px 'Segoe UI', Arial, sans-serif; fill: #39FF14; }
    .legend { font: 400 12px 'Segoe UI', Arial, sans-serif; fill: #c9d1d9; }
  </style>
  <rect class="bg" x="0.5" y="0.5" width="359" height="${height - 1}" rx="10"/>
  <text x="25" y="35" class="title">Most Used Languages</text>
  <rect x="25" y="60" width="${barWidth}" height="12" rx="6" fill="#161b22" />
  ${segments}
  ${legend}
</svg>`.trim();
}

function buildContributionGrid(user) {
  const weeks = user.contributionsCollection.contributionCalendar.weeks;
  const cell = 11, gap = 3;
  const width = weeks.length * (cell + gap) + 40;
  const height = 7 * (cell + gap) + 50;

  function colorFor(count) {
    if (count === 0) return "#161b22";
    if (count < 3) return "#0e4429";
    if (count < 6) return "#006d32";
    if (count < 10) return "#26a641";
    return "#39ff14";
  }

  let cells = "";
  weeks.forEach((week, wi) => {
    week.contributionDays.forEach((day) => {
      const dow = new Date(day.date).getUTCDay();
      const x = 25 + wi * (cell + gap);
      const y = 40 + dow * (cell + gap);
      cells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${colorFor(day.contributionCount)}"><title>${day.date}: ${day.contributionCount}</title></rect>`;
    });
  });

  const total = user.contributionsCollection.contributionCalendar.totalContributions;

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .bg { fill: #0d1117; stroke: #30363d; stroke-width: 1; }
    .title { font: 600 16px 'Segoe UI', Arial, sans-serif; fill: #39FF14; }
  </style>
  <rect class="bg" x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10"/>
  <text x="25" y="24" class="title">${total} contributions in the last year</text>
  ${cells}
</svg>`.trim();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const user = await fetchData();

  fs.writeFileSync(path.join(OUT_DIR, "stats-card.svg"), buildStatsCard(user));
  fs.writeFileSync(path.join(OUT_DIR, "langs-card.svg"), buildLangsCard(user));
  fs.writeFileSync(path.join(OUT_DIR, "contribution-grid.svg"), buildContributionGrid(user));

  console.log("Generated stats-card.svg, langs-card.svg, contribution-grid.svg");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
