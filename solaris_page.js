// ===== SOLARIS — learned policy net (runs in the page) =====
// Port of solaris_source_v1 (encode.js + nn.js + env.js observe/legalActions/step). The policy only gets {obs, legal}: fog-limited observation
// and the engine's legal action list. No hand-written rules, no search. Weights are embedded in the page.
const SOL = { net: null, name: '', info: '', dims: null };
(function () {
  const TERRAIN = 6, IMP_BUCKETS = 12, ID_BUCKETS = 32, MAXSTEPS = 700;
  const RES = ['fish', 'fruit', 'crop', 'metal', 'animal', 'starfish', 'aquacrop'];
  const FLAGS = ['naval', 'fly', 'scout', 'heal', 'convert', 'dash', 'escape', 'fortify', 'splash', 'stomp'];
  const ATYPES = ['move', 'atk', 'act', 'train', 'tech', 'build', 'reward', 'end'];
  const UNIT_STAT = 6 + FLAGS.length;
  let TECH_IDS = null, C = 0, S = 0, F = 0, CI = null;
  function hash(str, m) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return h % m; }
  function dims() {
    if (CI) return;
    TECH_IDS = Object.keys(TECHS);
    while (TECH_IDS.length < 51) TECH_IDS.push('_pad' + TECH_IDS.length); // the net was trained with 51 tech slots (25 standard + 26 from a removed tribe); the extra slots are always 0
    const CH = ['seen', 'visible'];
    for (let i = 0; i < TERRAIN; i++) CH.push('terr' + i);
    RES.forEach(r => CH.push('res_' + r));
    for (let i = 0; i < IMP_BUCKETS; i++) CH.push('imp' + i);
    ['own_mine', 'own_other', 'city', 'city_level', 'capital', 'walls', 'village', 'ruin', 'city_mine'].forEach(n => CH.push(n));
    const US = ['present', 'hpfrac', 'hp', 'a', 'd', 'm', 'r', 'cost', ...FLAGS];
    US.forEach(n => CH.push('my_' + n)); ['can_move', 'can_attack'].forEach(n => CH.push('my_' + n)); US.forEach(n => CH.push('en_' + n));
    C = CH.length; CI = Object.fromEntries(CH.map((n, i) => [n, i]));
    S = 6 + TECH_IDS.length + 16 + 16; F = ATYPES.length + UNIT_STAT + ID_BUCKETS + 4 + 4 + 1;
    SOL.dims = { C, S, F };
  }
  function unitStats(type, out, o) {
    const d = UNITS[type]; if (!d) return;
    out[o] = d.hp / 20; out[o + 1] = d.a / 5; out[o + 2] = d.d / 5; out[o + 3] = d.m / 3; out[o + 4] = d.r / 3; out[o + 5] = (d.c || 0) / 20;
    for (let i = 0; i < FLAGS.length; i++) if (d.sk.has(FLAGS[i])) out[o + 6 + i] = 1;
  }

  // ---------------------------------------------------------------- observation (fog-limited) and legal actions
  function observe(g, pid) {
    const N = g.N, p = g.players[pid]; CURG = g;
    const vis = visibleFor(g, pid), tiles = [];
    for (let i = 0; i < N * N; i++) {
      const seen = !!p.explored[i], tl = g.tiles[i];
      tiles.push(seen ? { seen: 1, visible: vis[i] ? 1 : 0, t: tl.t, res: tl.res || null, imp: tl.imp || null, owner: tl.owner, city: tl.city, village: tl.village ? 1 : 0, ruin: tl.ruin ? 1 : 0 } : { seen: 0, visible: 0 });
    }
    const units = g.units.filter(u => u.owner === pid || (vis[u.y * N + u.x] && visibleEnemy(g, u, pid)))
      .map(u => ({ id: u.id, owner: u.owner, type: u.type, x: u.x, y: u.y, hp: u.hp, mv: u.mv, at: u.at, done: u.done }));
    const cities = g.cities.filter(c => p.explored[c.y * N + c.x]).map(c => ({ id: c.id, owner: c.owner, x: c.x, y: c.y, level: c.level, capital: c.capital ? 1 : 0, walls: c.walls ? 1 : 0 }));
    const met = g.players.filter((q, i) => i !== pid && p.met && p.met[i]).map(q => ({ id: q.id, tribe: q.tribe, alive: q.alive ? 1 : 0 }));
    return { pid, tribe: p.tribe, numPlayers: g.players.length, met, turn: g.turn, stars: p.stars, income: income(g, pid), techs: Object.keys(p.tech), N, tiles, units, cities, pending: pendingReward(g, pid) };
  }
  function pendingReward(g, pid) { return g.pending.find(p => g.cities[p.city] && g.cities[p.city].owner === pid) || null; }
  function legalActions(g, pid) {
    const out = []; CURG = g;
    const pend = pendingReward(g, pid);
    if (pend) { for (const o of REWARDS[pend.lv]) out.push({ k: 'reward', city: pend.city, ch: o[0] }); return out; }
    const stars = g.players[pid].stars;
    for (const u of g.units) {
      if (u.owner !== pid || u.done || u.frozen) continue;
      if (canMove(u)) for (const idx of reachable(g, u).keys()) out.push({ k: 'move', u: u.id, x: idx % g.N, y: (idx / g.N) | 0 });
      if (canAttack(u)) for (const e of attackTargets(g, u)) out.push({ k: 'atk', u: u.id, e: e.id });
      for (const a of unitActions(g, u)) if (!(a.c > 0) || a.c <= stars) out.push({ k: 'act', u: u.id, id: a.id });
    }
    for (const c of g.cities) { if (c.owner !== pid) continue; for (const t of trainable(g, pid)) if (canTrain(g, c, t)) out.push({ k: 'train', c: c.id, ty: t }); }
    for (const t of Object.keys(TECHS)) if (techAvail(g, pid, t) && techCost(g, pid, t) <= stars) out.push({ k: 'tech', t });
    for (let i = 0; i < g.tiles.length; i++) {
      const tl = g.tiles[i]; if (tl.owner !== pid || tl.cityOf < 0) continue;
      const x = i % g.N, y = (i / g.N) | 0;
      for (const o of tileOptions(g, pid, x, y)) if (!(o.c > 0) || o.c <= stars) out.push({ k: 'build', x, y, id: o.id });
    }
    out.push({ k: 'end' });
    return out;
  }
  // returns true (applied), false (rejected, nothing changed) or 'end'
  function step(g, pid, a) {
    CURG = g; let ok = false; const unit = id => g.units.find(x => x.id === id);
    switch (a.k) {
      case 'move': { const u = unit(a.u); ok = !!u && u.owner === pid && !!moveUnit(g, u, a.x, a.y); break; }
      case 'atk': { const u = unit(a.u), t = unit(a.e); ok = !!u && !!t && u.owner === pid && !!doAttack(g, u, t); break; }
      case 'act': { const u = unit(a.u); ok = !!u && u.owner === pid && !!doAction(g, u, a.id); break; }
      case 'train': ok = !!g.cities[a.c] && g.cities[a.c].owner === pid && !!train(g, g.cities[a.c], a.ty, null); break;
      case 'tech': ok = !!research(g, pid, a.t); break;
      case 'build': ok = !!doTileOption(g, pid, a.x, a.y, a.id); break;
      case 'reward': {
        const i = g.pending.findIndex(p => p.city === a.city && g.cities[p.city].owner === pid);
        if (i >= 0 && REWARDS[g.pending[i].lv].some(o => o[0] === a.ch)) { const p = g.pending.splice(i, 1)[0]; applyReward(g, g.cities[p.city], a.ch); ok = true; }
        break;
      }
      case 'end': return pendingReward(g, pid) ? false : 'end';
    }
    if (ok) { if (pid === (g.view || 0)) updateVision(g); else { const v = visibleFor(g, pid); if (g.players[pid].alive) { checkMeet(g, pid, v); checkLights(g, pid, v); } } }
    return ok;
  }

  // ---------------------------------------------------------------- encoder (same layout as the training code)
  function encode(obs, legal) {
    dims();
    const N = obs.N, pid = obs.pid, NN = N * N, grid = new Float32Array(C * NN), at = (c, i) => c * NN + i;
    for (let i = 0; i < NN; i++) {
      const t = obs.tiles[i]; if (!t.seen) continue;
      grid[at(CI.seen, i)] = 1; if (t.visible) grid[at(CI.visible, i)] = 1;
      grid[at(CI.terr0 + Math.min(t.t, TERRAIN - 1), i)] = 1;
      if (t.res) { const r = RES.indexOf(t.res); if (r >= 0) grid[at(CI.res_fish + r, i)] = 1; }
      if (t.imp) grid[at(CI.imp0 + hash(String(t.imp), IMP_BUCKETS), i)] = 1;
      if (t.owner >= 0) grid[at(t.owner === pid ? CI.own_mine : CI.own_other, i)] = 1;
      if (t.village) grid[at(CI.village, i)] = 1;
      if (t.ruin) grid[at(CI.ruin, i)] = 1;
    }
    let myCities = 0;
    for (const c of obs.cities) {
      const i = c.y * N + c.x;
      grid[at(CI.city, i)] = 1; grid[at(CI.city_level, i)] = c.level / 6; if (c.capital) grid[at(CI.capital, i)] = 1; if (c.walls) grid[at(CI.walls, i)] = 1;
      if (c.owner === pid) { grid[at(CI.city_mine, i)] = 1; myCities++; }
    }
    let myUnits = 0; const unitById = new Map();
    for (const u of obs.units) {
      unitById.set(u.id, u);
      const i = u.y * N + u.x, d = UNITS[u.type]; if (!d) continue;
      const side = u.owner === pid ? 'my_' : 'en_';
      grid[at(CI[side + 'present'], i)] = 1; grid[at(CI[side + 'hpfrac'], i)] = Math.min(1.5, u.hp / d.hp); grid[at(CI[side + 'hp'], i)] = u.hp / 20;
      grid[at(CI[side + 'a'], i)] = d.a / 5; grid[at(CI[side + 'd'], i)] = d.d / 5; grid[at(CI[side + 'm'], i)] = d.m / 3; grid[at(CI[side + 'r'], i)] = d.r / 3; grid[at(CI[side + 'cost'], i)] = (d.c || 0) / 20;
      FLAGS.forEach(f => { if (d.sk.has(f)) grid[at(CI[side + f], i)] = 1; });
      if (u.owner === pid) { myUnits++; if (!u.mv && !u.done) grid[at(CI.my_can_move, i)] = 1; if (!u.at && !u.done) grid[at(CI.my_can_attack, i)] = 1; }
    }
    const sc = new Float32Array(S);
    sc[0] = obs.turn / 30; sc[1] = obs.stars / 20; sc[2] = obs.income / 10; sc[3] = myCities / 6; sc[4] = myUnits / 12; sc[5] = obs.pending ? 1 : 0;
    for (const t of obs.techs) { const k = TECH_IDS.indexOf(t); if (k >= 0) sc[6 + k] = 1; }
    sc[6 + TECH_IDS.length + (obs.tribe & 15)] = 1;
    for (const m of obs.met) sc[6 + TECH_IDS.length + 16 + (m.tribe & 15)] = 1;
    const A = legal.length, af = new Float32Array(A * F), src = new Int32Array(A).fill(-1), dst = new Int32Array(A).fill(-1);
    const ofs = ATYPES.length, idO = ofs + UNIT_STAT, xyO = idO + ID_BUCKETS;
    for (let k = 0; k < A; k++) {
      const a = legal[k], b = k * F; af[b + ATYPES.indexOf(a.k)] = 1;
      let sx = -1, sy = -1, dx = -1, dy = -1, key = null;
      if (a.k === 'move') { const u = unitById.get(a.u); if (u) { sx = u.x; sy = u.y; unitStats(u.type, af, b + ofs); } dx = a.x; dy = a.y; }
      else if (a.k === 'atk') { const u = unitById.get(a.u), e = unitById.get(a.e); if (u) { sx = u.x; sy = u.y; unitStats(u.type, af, b + ofs); } if (e) { dx = e.x; dy = e.y; } }
      else if (a.k === 'act') { const u = unitById.get(a.u); if (u) { sx = u.x; sy = u.y; dx = u.x; dy = u.y; unitStats(u.type, af, b + ofs); } key = a.id.split(':')[0]; }
      else if (a.k === 'train') { const c = obs.cities.find(q => q.id === a.c); if (c) { sx = c.x; sy = c.y; dx = c.x; dy = c.y; } unitStats(a.ty, af, b + ofs); key = 'train_' + a.ty; }
      else if (a.k === 'tech') key = 'tech_' + a.t;
      else if (a.k === 'build') { sx = a.x; sy = a.y; dx = a.x; dy = a.y; key = a.id; }
      else if (a.k === 'reward') { const c = obs.cities.find(q => q.id === a.city); if (c) { sx = c.x; sy = c.y; dx = c.x; dy = c.y; } key = 'rw_' + a.ch; }
      if (key) af[b + idO + hash(key, ID_BUCKETS)] = 1;
      if (sx >= 0) { src[k] = sy * N + sx; af[b + xyO] = sx / N; af[b + xyO + 1] = sy / N; }
      if (dx >= 0) { dst[k] = dy * N + dx; af[b + xyO + 4] = dx / N; af[b + xyO + 5] = dy / N; }
      if (sx >= 0 && dx >= 0) af[b + xyO + 8] = Math.max(Math.abs(sx - dx), Math.abs(sy - dy)) / 4;
    }
    return { N, A, grid, scalars: sc, actFeat: af, src, dst };
  }

  // ---------------------------------------------------------------- network (forward pass only)
  const DEF = { K: 16, HS: 64, HA: 64, HV: 32 };
  function layout(Cc, Ss, Ff, cfg) {
    const { K, HS, HA, HV } = cfg;
    const spec = [['W1', K * Cc * 9], ['b1', K], ['W2', K * K * 9], ['b2', K], ['Ws', HS * (K + Ss)], ['bs', HS], ['Wa1', HA * (HS + Ff + 2 * K)], ['ba1', HA], ['wa2', HA], ['ba2', 1], ['Wv1', HV * HS], ['bv1', HV], ['wv2', HV], ['bv2', 1]];
    const off = {}; let n = 0; for (const [k, sz] of spec) { off[k] = [n, sz]; n += sz; } return { off, n };
  }
  function relu(a) { const o = new Float64Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] > 0 ? a[i] : 0; return o; }
  function dense(W, b, x, outN) { const n = x.length, o = new Float64Array(outN); for (let j = 0; j < outN; j++) { let t = b[j]; const w = j * n; for (let i = 0; i < n; i++) t += W[w + i] * x[i]; o[j] = t; } return o; }
  function conv(inp, Cin, N, W, b, Cout) {
    const NN = N * N, out = new Float64Array(Cout * NN);
    for (let oc = 0; oc < Cout; oc++) {
      const ob = oc * NN; for (let i = 0; i < NN; i++) out[ob + i] = b[oc];
      for (let ic = 0; ic < Cin; ic++) {
        const ib = ic * NN, wb = (oc * Cin + ic) * 9;
        for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 3; kx++) {
          const w = W[wb + ky * 3 + kx]; if (w === 0) continue; const dy = ky - 1, dx = kx - 1;
          for (let y = Math.max(0, -dy); y < Math.min(N, N - dy); y++) for (let x = Math.max(0, -dx); x < Math.min(N, N - dx); x++) out[ob + y * N + x] += w * inp[ib + (y + dy) * N + x + dx];
        }
      }
    }
    return out;
  }
  class Net {
    constructor(Cc, Ss, Ff, cfg) { this.C = Cc; this.S = Ss; this.F = Ff; this.cfg = Object.assign({}, DEF, cfg || {}); const L = layout(Cc, Ss, Ff, this.cfg); this.off = L.off; this.n = L.n; this.p = new Float64Array(this.n); }
    view(name) { const [o, sz] = this.off[name]; return this.p.subarray(o, o + sz); }
    logits(enc) {
      const { C: Cc, S: Ss, F: Ff } = this, { K, HS, HA } = this.cfg, N = enc.N, NN = N * N, A = enc.A;
      const h1 = relu(conv(enc.grid, Cc, N, this.view('W1'), this.view('b1'), K)), h2 = relu(conv(h1, K, N, this.view('W2'), this.view('b2'), K));
      const sIn = new Float64Array(K + Ss);
      for (let c = 0; c < K; c++) { let t = 0; for (let i = 0; i < NN; i++) t += h2[c * NN + i]; sIn[c] = t / NN; }
      for (let i = 0; i < Ss; i++) sIn[K + i] = enc.scalars[i];
      const s = relu(dense(this.view('Ws'), this.view('bs'), sIn, HS)), D = HS + Ff + 2 * K, out = new Float64Array(A);
      const Wa1 = this.view('Wa1'), ba1 = this.view('ba1'), wa2 = this.view('wa2'), ba2 = this.view('ba2')[0], x = new Float64Array(D);
      for (let k = 0; k < A; k++) {
        x.fill(0); x.set(s, 0); for (let i = 0; i < Ff; i++) x[HS + i] = enc.actFeat[k * Ff + i];
        if (enc.src[k] >= 0) for (let c = 0; c < K; c++) x[HS + Ff + c] = h2[c * NN + enc.src[k]];
        if (enc.dst[k] >= 0) for (let c = 0; c < K; c++) x[HS + Ff + K + c] = h2[c * NN + enc.dst[k]];
        let lg = ba2; for (let j = 0; j < HA; j++) { let t = ba1[j]; const w = j * D; for (let i = 0; i < D; i++) t += Wa1[w + i] * x[i]; if (t > 0) lg += wa2[j] * t; }
        out[k] = lg;
      }
      return out;
    }
  }
  SOL.makeNet = (seed) => { dims(); const n = new Net(C, S, F); let a = seed >>> 0; const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; for (let i = 0; i < n.n; i++) n.p[i] = (Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r())) * 0.08; return n; }; // test only: random weights

  // ---------------------------------------------------------------- loading
  SOL.load = function (json, name) {
    dims(); const ck = json && (json.net || json);
    if (!ck || !Array.isArray(ck.p)) throw new Error('Solaris 체크포인트 형식이 아니에요 (p 배열 없음)');
    if (ck.C !== C || ck.S !== S || ck.F !== F) throw new Error(`가중치의 입력 크기(C${ck.C}/S${ck.S}/F${ck.F})가 이 엔진(C${C}/S${S}/F${F})과 달라요. 학습에 쓴 엔진과 테크·유닛 목록이 달라진 것 같아요`);
    const net = new Net(C, S, F, ck.cfg); if (ck.p.length !== net.n) throw new Error(`가중치 개수가 안 맞아요 (${ck.p.length} / 필요 ${net.n})`);
    net.p.set(ck.p); SOL.net = net; SOL.name = name || ck.name || 'solaris'; SOL.info = `${net.n.toLocaleString()} params`;
    delete DIFFS.solaris.hide; // appears in the bot pickers once weights are present
    return net;
  };
  SOL.unload = () => { SOL.net = null; DIFFS.solaris.hide = 1; };

  // ---------------------------------------------------------------- playing a turn
  DIFFS.solaris = Object.assign({}, DIFFS.lunaris, { n: 'Solaris', ob: 0, sol: 1, hide: 1, custom: 1 }); // ob 0: same income as a human, like the training seats
  // The policy seat is human-flagged while it plays (as in training): level-up rewards come to the policy, income has no bot bonus.
  SOL.begin = function (g, pid) { const p = g.players[pid]; const st = { pid, steps: 0, bad: new Set(), ai: p.ai, diff: p.diff }; p.ai = false; p.diff = null; CURG = g; return st; };
  SOL.finish = function (g, st) { const p = g.players[st.pid]; p.ai = st.ai; p.diff = st.diff; };
  // one decision; returns 'end' when the policy ends its turn
  SOL.act = function (g, st) {
    if (!SOL.net) throw new Error('Solaris 가중치가 없어요');
    const pid = st.pid; let legal = legalActions(g, pid).filter(a => !st.bad.has(JSON.stringify(a)));
    if (!legal.length) return 'end';
    let a;
    if (++st.steps > MAXSTEPS) a = legal.find(x => x.k === 'end') || legal.find(x => x.k === 'reward') || legal[0]; // safety valve
    else { const lg = SOL.net.logits(encode(observe(g, pid), legal)); let b = 0; for (let k = 1; k < lg.length; k++) if (lg[k] > lg[b]) b = k; a = legal[b]; } // greedy
    const r = step(g, pid, a);
    if (r === 'end') return 'end';
    if (!r) { st.bad.add(JSON.stringify(a)); if (st.steps > MAXSTEPS + 20) return 'end'; }
    return 'cont';
  };
  SOL.playTurn = function (g, pid) { const st = SOL.begin(g, pid); try { while (SOL.act(g, st) !== 'end'); } finally { SOL.finish(g, st); } return st.steps; }; // synchronous (tests / headless)

  // the weights are embedded in the page (<script type="application/json" id="solarisNet">)
  try { const el = document.getElementById('solarisNet'); if (el) SOL.load(JSON.parse(el.textContent), 'Solaris'); } catch (e) { console.error('Solaris weights not loaded:', e); }
})();
