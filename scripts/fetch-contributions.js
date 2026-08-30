#!/usr/bin/env node
/**
 * fetch-contributions.js
 *
 * Pulls the last year of contribution data for GITHUB_USER via GitHub's
 * GraphQL API and writes it to dist/contributions.json in the shape
 * generate-spacecraft-snake.js expects.
 *
 * Requires:
 *   GITHUB_TOKEN  - a token with read access (the default Actions token works)
 *   GITHUB_USER   - the username to read the graph for
 *
 * Usage:
 *   GITHUB_TOKEN=xxx GITHUB_USER=yourname node scripts/fetch-contributions.js
 */
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN;
const USER = process.env.GITHUB_USER;

if (!TOKEN || !USER) {
  console.error('Set GITHUB_TOKEN and GITHUB_USER env vars first.');
  process.exit(1);
}

const query = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks {
          contributionDays {
            date
            contributionCount
            contributionLevel
          }
        }
      }
    }
  }
}`;

const LEVEL_MAP = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

async function main() {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  const weeksRaw = json.data.user.contributionsCollection.contributionCalendar.weeks;

  const weeks = weeksRaw.map((w) => ({
    days: w.contributionDays.map((d) => ({
      date: d.date,
      level: LEVEL_MAP[d.contributionLevel] ?? 0,
    })),
  }));

  const outPath = path.join('dist', 'contributions.json');
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ weeks }, null, 2));
  console.log(`Wrote ${outPath} (${weeks.length} weeks)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
