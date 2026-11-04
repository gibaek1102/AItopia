// Deterministic bot-vs-bot replay: same seed, all 16 official tribes. Prints a per-round digest so two builds can be diffed.
const { chromium } = require('playwright');
const [file, seedArg, roundsArg, diffArg] = process.argv.slice(2);
(async () => {
  const br = await chromium.launch();
  const pg = await br.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + file); await pg.waitForSelector('#sGo');
  const out = await pg.evaluate(({ seed, rounds, diff }) => {
    const mul = s => () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    Math.random = mul(seed);
    const tribes = TRIBES.map((t, i) => i);
    const g = newGame({ size: 16, tribes, diff, diffs: tribes.slice(1).map(() => diff), mapType: 'continents' });
    g.players[0].ai = true; g.players[0].diff = diff; g.noReview = true; g.spectate = 1;
    const digest = [];
    for (let r = 0; r < rounds && !g.over; r++) {
      runAITurns(g);
      const per = g.players.map(p => p.id).map(i => `${g.cities.filter(c => c.owner === i).length}/${g.units.filter(u => u.owner === i).length}/${g.players[i].stars}/${Object.keys(g.players[i].tech).length}`);
      digest.push(`T${g.turn}|${per.join(',')}`);
    }
    return { tribes: TRIBES.length, techs: Object.keys(TECHS).length, digest, over: g.over };
  }, { seed: +seedArg, rounds: +roundsArg, diff: diffArg });
  console.log(JSON.stringify({ tribes: out.tribes, techs: out.techs, over: out.over, errs }));
  console.log(out.digest.join('\n'));
  await br.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
