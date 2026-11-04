// Solaris with the embedded real weights: appears in the picker, then plays real games vs engine bots (headless, in the page)
const { chromium } = require('playwright');
const file = process.argv[2], N = +process.argv[3] || 6, diff = process.argv[4] || 'crazy';
(async () => {
  const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 420, height: 800 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + file); await pg.waitForSelector('#sGo');
  console.log('Solaris in picker:', await pg.locator('button[data-k="diff"]:has-text("Solaris")').count(), '| file-load button present:', await pg.locator('#sSol, #sSolF').count());
  const r = await pg.evaluate(({ N, diff }) => {
    const mul = s => () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const out = { weights: SOL.info, games: [] };
    for (let k = 0; k < N; k++) {
      Math.random = mul(1000 + k);
      const solSeat = k % 2;                                    // alternate seats
      const g = newGame({ size: 12, tribes: [1, 0], diff, diffs: [diff], mapType: 'continents' });
      g.noReview = true;
      // seat 0 is created as the human seat; make both seats bots, then mark Solaris
      g.players[0].ai = true; g.players[0].diff = diff; g.players[1].ai = true; g.players[1].diff = diff;
      g.players[solSeat].diff = 'solaris';
      let steps = 0, t0 = performance.now();
      while (!g.over && g.turn <= 25) {
        const pid = g.cur;
        if (g.players[pid].diff === 'solaris') steps += SOL.playTurn(g, pid); else aiTurn(g, pid);
        endTurn(g);
      }
      const sc = [0, 1].map(i => scoreOf(g, i));
      out.games.push({ k, solSeat, turn: g.turn, alive: g.players.map(p => p.alive), cities: [0, 1].map(i => g.cities.filter(c => c.owner === i).length), units: [0, 1].map(i => g.units.filter(u => u.owner === i).length), techs: [0, 1].map(i => Object.keys(g.players[i].tech).length), score: sc, solScore: sc[solSeat], oppScore: sc[1 - solSeat], steps, ms: Math.round(performance.now() - t0) });
    }
    return out;
  }, { N, diff });
  console.log('weights:', r.weights);
  let w = 0, l = 0, d = 0;
  for (const g of r.games) { const res = g.solScore > g.oppScore ? 'W' : g.solScore < g.oppScore ? 'L' : 'D'; if (res === 'W') w++; else if (res === 'L') l++; else d++;
    console.log(`game ${g.k} seat${g.solSeat} turn${g.turn} alive${g.alive} cities${g.cities} units${g.units} techs${g.techs} score(sol/opp) ${g.solScore}/${g.oppScore} steps${g.steps} ${g.ms}ms ${res}`); }
  console.log(`Solaris vs ${diff} by score at turn 25: W${w} D${d} L${l}   errors:`, errs.length ? errs : 'none');
  await br.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
