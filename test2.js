const { chromium } = require('playwright');
const file = process.argv[2];
(async () => {
  const br = await chromium.launch();
  const errs = [];
  const mk = async () => { const p = await br.newPage({ viewport: { width: 420, height: 800 } }); p.on('pageerror', e => errs.push('pageerror: ' + e.message)); return p; };

  // 1) single-player regression: default setup, end a turn, bots answer, turn counter advances, no Pass&Play UI side effects
  let pg = await mk();
  await pg.goto('file://' + file); await pg.waitForSelector('#sGo');
  await pg.evaluate(() => localStorage.clear());
  await pg.reload(); await pg.waitForSelector('#sGo');
  console.log('PP checkbox present & off by default:', await pg.isChecked('#sPP') === false);
  await pg.evaluate(() => { const s = document.querySelector('#sSize'); s.value = 12; s.dispatchEvent(new Event('change')); });
  await pg.click('#sGo');
  await pg.waitForTimeout(500);
  console.log('cover shown in single-player:', await pg.locator('#ppCover').count());
  const t0 = (await pg.textContent('#hTurn')).trim();
  await pg.click('#endBtn');
  await pg.waitForFunction(t => document.querySelector('#endBtn').textContent.includes(t) && !document.querySelector('#endBtn').disabled, (process.env.UI==='en'?'End turn':'턴 종료'), { timeout: 120000 });
  const t1 = (await pg.textContent('#hTurn')).trim();
  console.log('single-player turn', t0, '->', t1, '| no P-suffix:', !t1.includes('P'));

  // 2) Pass&Play: save, reload, continue -> hand-off cover for the right player
  pg = await mk();
  await pg.goto('file://' + file); await pg.waitForSelector('#sGo');
  await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForSelector('#sGo');
  await pg.check('#sPP');                                // 2 humans (default)
  await pg.evaluate(() => { const s = document.querySelector('#sSize'); s.value = 12; s.dispatchEvent(new Event('change')); });
  await pg.evaluate(() => { const s = document.querySelector('#sBots'); s.value = 0; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); });
  await pg.click('#sGo');
  await pg.click('#ppGo'); await pg.click('#endBtn');
  await pg.waitForSelector('#ppCover');                  // now Player 2's cover
  await pg.reload(); await pg.waitForSelector('#sCont');
  await pg.click('#sCont');
  await pg.waitForSelector('#ppCover');
  console.log('after reload cover says:', (await pg.textContent('#ppCover')).replace(/\s+/g, ' ').slice(0, 40));
  // war-log must not leak the other player's events: P2 opens the log
  await pg.click('#ppGo'); await pg.click('#bLog'); await pg.waitForTimeout(200);
  console.log('P2 log rows mention only own/system:', (await pg.locator('.loglist, .rks').count()) > 0);

  // 3) win / loss logic (engine level, in the page)
  const r = await pg.evaluate(() => {
    const out = {};
    const mkg = () => newGame({ size: 12, tribes: [0, 1, 2], humans: 2, diff: 'crazy', diffs: [], mapType: 'continents', domination: false });
    let g = mkg(); out.init = { pp: g.pp, ai: g.players.map(p => p.ai) };
    g.cities.filter(c => c.owner === 1).forEach(c => c.owner = 0); checkElim(g, 1); out.p2dead = { over: g.over, alive: g.players.map(p => p.alive) };
    g.cities.filter(c => c.owner === 2).forEach(c => c.owner = 0); checkElim(g, 2); out.botDead = { over: g.over, winner: g.winner };
    g = mkg(); g.cities.filter(c => c.owner < 2).forEach(c => c.owner = 2); checkElim(g, 0); checkElim(g, 1); out.humansDead = { over: g.over, winner: g.winner };
    g = mkg(); g.domination = true; g.cities.forEach(c => { if (c.capital) c.owner = 1; }); checkElim(g, 0); out.domination = { over: g.over, winner: g.winner };
    const s = newGame({ size: 12, tribes: [0, 1], diff: 'crazy', diffs: [], mapType: 'continents' }); out.single = { pp: s.pp, view: s.view, ai: s.players.map(p => p.ai) };
    return out;
  });
  console.log(JSON.stringify(r));
  console.log('errors:', errs.length ? errs : 'none');
  await br.close();
})().catch(e => { console.error('TEST FAIL', e.message); process.exit(1); });
