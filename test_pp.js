const { chromium } = require('playwright');
const file = process.argv[2];
(async () => {
  const br = await chromium.launch();
  const pg = await br.newPage({ viewport: { width: 420, height: 800 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await pg.goto('file://' + file);
  await pg.waitForSelector('#sGo', { timeout: 15000 });
  await pg.evaluate(() => localStorage.removeItem('vpoly-save-v1'));
  // enable Pass & Play, 3 humans, 1 bot, small map
  await pg.check('#sPP');
  await pg.click('[data-hum="3"]');
  await pg.evaluate(() => { const s = document.querySelector('#sSize'); s.value = 12; s.dispatchEvent(new Event('change')); });
  await pg.evaluate(() => { const s = document.querySelector('#sBots'); s.value = 1; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); });
  console.log('humans rows:', await pg.locator('[data-pt]').count());
  await pg.click('#sGo');
  const hud = async () => (await pg.textContent('#hTurn')).trim();
  const state = () => pg.evaluate(() => { const g = JSON.parse(localStorage.getItem('vpoly-save-v1')); return { turn: g.turn, cur: g.cur, view: g.view, pp: g.pp, players: g.players.map(p => ({ ai: p.ai, alive: p.alive, stars: p.stars, exp: p.explored.reduce((a, b) => a + b, 0) })) }; });
  const log = [];
  for (let step = 0; step < 7; step++) {
    await pg.waitForSelector('#ppCover', { timeout: 120000 });
    const cover = (await pg.textContent('#ppCover')).replace(/\s+/g, ' ').trim();
    if (step === 0) await pg.screenshot({ path: '/home/claude/work/shot_cover.png' });
    // while the cover is up the board must not be clickable/visible through it
    const top = await pg.evaluate(() => { const e = document.elementFromPoint(210, 400); return e && (e.closest('#ppCover') ? 'cover' : e.id || e.tagName); });
    await pg.click('#ppGo');
    await pg.waitForSelector('#ppCover', { state: 'detached' });
    const h = await hud();
    const st = await state();
    log.push({ step, cover: cover.slice(0, 60), top, hud: h, cur: st.cur, view: st.view, endDisabled: await pg.isDisabled('#endBtn') });
    if (step === 1) await pg.screenshot({ path: '/home/claude/work/shot_p2.png' });
    // human buys/moves nothing; just end the turn
    await pg.click('#endBtn');
  }
  console.log(JSON.stringify(log, null, 1));
  console.log('final', JSON.stringify(await state()));
  console.log('errors:', errs.length ? errs.slice(0, 8) : 'none');
  await br.close();
})().catch(e => { console.error('TEST FAIL', e.message); process.exit(1); });
