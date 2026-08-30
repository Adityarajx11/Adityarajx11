// Fake contribution grid for local previewing / testing.
// 53 weeks x 7 days, random-ish levels with some empty stretches.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const rand = seeded(42);

const weeks = [];
const start = new Date('2025-01-05'); // a Sunday
for (let w = 0; w < 53; w++) {
  const days = [];
  for (let d = 0; d < 7; d++) {
    const r = rand();
    let level = 0;
    if (r > 0.55) level = 1;
    if (r > 0.7) level = 2;
    if (r > 0.85) level = 3;
    if (r > 0.95) level = 4;
    const date = new Date(start);
    date.setDate(date.getDate() + w * 7 + d);
    days.push({ date: date.toISOString().slice(0, 10), level });
  }
  weeks.push({ days });
}

module.exports = { weeks };
