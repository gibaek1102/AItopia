#!/usr/bin/env python3
"""Pass & Play patch for Virtual Polytopia (Terranion 1.4 build).
Usage: python3 patch_pp.py <in.html> <out.html>
Single-player behaviour is unchanged: every new path is gated on g.pp (humans > 1), and V() returns 0 otherwise."""
import re, sys

src = open(sys.argv[1], encoding='utf8').read()
n_edit = 0

def rep(old, new, count=1):
    """exact replacement, asserting how many times `old` occurs"""
    global src, n_edit
    c = src.count(old)
    assert c == count, f'expected {count} match(es), found {c}: {old[:90]!r}'
    src = src.replace(old, new)
    n_edit += 1

# ---------------------------------------------------------------- engine
rep("const g={solo:!!opts.solo,", "const H=Math.max(1,opts.humans||1); const g={pp:H>1?H:0,view:0,solo:!!opts.solo,")
rep("ai:i>0,diff:i>0?((opts.diffs&&opts.diffs[i-1])||opts.diff):null",
    "ai:i>=H,diff:i>=H?((opts.diffs&&opts.diffs[i-H])||opts.diff):null")
rep("else g.pending.push({city:c.id,lv});", "else g.pending.push({city:c.id,lv,owner:c.owner});")

rep("""  if (g.spectate){ if (alive.length<=1) g.over='end'; }""",
"""  if (g.pp){ // Pass & Play: ends when one tribe is left, nobody human is left, or one tribe holds every capital
    const humansLeft=alive.filter(q=>!q.ai).length;
    if (alive.length<=1 || humansLeft===0){ g.over='end'; g.winner=alive.length===1?alive[0].id:-1; }
    else if (g.domination){ const caps=g.cities.filter(c=>c.capital); if (caps.length>1 && caps.every(c=>c.owner===caps[0].owner)){ g.over='end'; g.winner=caps[0].owner; } }
  }
  else if (g.spectate){ if (alive.length<=1) g.over='end'; }""")

rep("""  const p=g.players[0]; const v=visibleFor(g,0); g.vis=v;
  for (let i=0;i<v.length;i++) if(v[i]) p.explored[i]=1;
  if (p.alive && g.started!==false) checkMeet(g,0,v);
  if (g.players[0].alive && !g._inLights){ g._inLights=1; checkLights(g,0,v); g._inLights=0; }""",
"""  const w=g.view||0, p=g.players[w]; const v=visibleFor(g,w); g.vis=v; // g.view = whose screen it is (Pass & Play); 0 otherwise
  for (let i=0;i<v.length;i++) if(v[i]) p.explored[i]=1;
  if (p.alive && g.started!==false) checkMeet(g,w,v);
  if (p.alive && !g._inLights){ g._inLights=1; checkLights(g,w,v); g._inLights=0; }""")

# ---------------------------------------------------------------- UI: manual edits (original strings)
rep("let g=null, dpr=1, cam={x:0,y:0,z:1};",
    "let g=null, dpr=1, cam={x:0,y:0,z:1};\nfunction V(){ return (g&&g.view)||0; } // the player whose screen this is (always 0 outside Pass & Play)")

rep("(g.spectate || g.players[0].alive);", "(g.spectate || (!g.pp && g.players[0].alive));")
rep("    if(!g.over && g.cur===0) reviewStart(g,0);",
    "    if(g.pp){ if(!g.over) ppHandoff(); } else if(!g.over && g.cur===0) reviewStart(g,0);")
rep("    if(ev.length) toast(", "    if(ev.length && !g.pp) toast(")
rep("save(); checkOver(); refresh(); if(!g.over && !checkOffers()) checkPending(); done&&done();",
    "save(); checkOver(); refresh(); if(!g.over && !g.pp && !checkOffers()) checkPending(); done&&done();")

rep("if((g.cur!==0||g.spectate) && !g.over){ aiLoop(()=>{}); } else if(!g.over && !g._rv) reviewStart(g,0);",
    "if((g.players[g.cur].ai||g.spectate) && !g.over){ aiLoop(()=>{}); } else if(g.pp){ if(!g.over) ppHandoff(); } else if(!g.over && !g._rv) reviewStart(g,0);")

rep("""  if(!g.pending.length) return;
  const pr=g.pending[0], c=g.cities[pr.city], opts=REWARDS[pr.lv];""",
"""  if(!g.pending.length) return;
  const pi=g.pending.findIndex(q=>q.owner==null||q.owner===V()); if(pi<0) return; // Pass & Play: each player only sees their own level-up rewards
  const pr=g.pending[pi], c=g.cities[pr.city], opts=REWARDS[pr.lv];""")
rep("g.pending.shift(); applyReward(g,c,b.dataset.k);", "g.pending.splice(pi,1); applyReward(g,c,b.dataset.k);")

rep("  if(g.spectate){ specOver(); return; }\n  if(!g.eloDone)", "  if(g.spectate){ specOver(); return; }\n  if(g.pp){ ppOver(); return; }\n  if(!g.eloDone)")

rep("""  const of=(g.offers||[]).filter(o=>g.players[o.from].alive && !atPeace(g,0,o.from));
  if(!of.length){ g.offers=[]; return false; }
  const o=of[0]; g.offers=of.slice(1);""",
"""  const me=V(), all=g.offers||[]; // offers carry `to` (human-to-human, Pass & Play); bot offers have no `to` and go to player 0
  const of=all.filter(o=>(o.to==null?0:o.to)===me && g.players[o.from].alive && !atPeace(g,me,o.from));
  g.offers=all.filter(o=>(o.to==null?0:o.to)!==me && g.players[o.from].alive);
  if(!of.length) return false;
  const o=of[0]; g.offers=g.offers.concat(of.slice(1));""")
rep("(${diffOf(g,o.from).n})가 평화 조약을 제안했어요.",
    "(${g.players[o.from].ai?diffOf(g,o.from).n:'Player '+(o.from+1)})가 평화 조약을 제안했어요.")
rep("makePeace(g,o.from,0); closeModal();", "makePeace(g,o.from,me); closeModal();")

rep("const r=proposePeace(g,0,+b.dataset.pc); toast(r.ok?'평화 조약 체결!':'거절: '+r.why,2600);",
    "const tid=+b.dataset.pc, hum=g.pp&&!g.players[tid].ai, r=hum?ppOffer(V(),tid):proposePeace(g,V(),tid); toast(r.ok?(hum?'평화 제안을 보냈어요. 상대 차례에 표시돼요.':'평화 조약 체결!'):'거절: '+r.why,2600);")
rep("<small>${diffOf(g,p.id).n}</small><span class=\"dm\">",
    "<small>${p.ai?diffOf(g,p.id).n:'Player '+(p.id+1)}</small><span class=\"dm\">")

rep("g.log.slice(-80).reverse()", "g.log.filter(l=>!g.pp||l.p===V()||l.p<0).slice(-80).reverse()")  # no cross-player leaks in the war log

rep("$('hTurn').textContent=innerWidth<=480?`T${g.turn}`:`턴 ${g.turn}`;",
    "$('hTurn').textContent=(innerWidth<=480?`T${g.turn}`:`턴 ${g.turn}`)+(g.pp?` · P${V()+1}`:'');")

# ---------------------------------------------------------------- UI: mechanical 0 -> V() in the play UI (before the advisor mode)
a = src.index("let g=null, dpr=1")
b = src.index("// ================= 실전 분석 모드 (advisor)")
ui = src[a:b]
subs = [
    (r'\bg\.players\[0\]', 'g.players[V()]'),
    (r'uName\(g,(\w+),0\)', r'uName(g,\1,V())'),
    (r'owner===0', 'owner===V()'), (r'owner!==0', 'owner!==V()'),
    (r'g\.cur===0', 'g.cur===V()'), (r'g\.cur!==0', 'g.cur!==V()'),
    (r'visibleEnemy\(g,(\w+),0\)', r'visibleEnemy(g,\1,V())'),
    (r'\(g,0([,)])', r'(g,V()\1'),
    (r'isLit\(u,0\)', 'isLit(u,V())'),
    (r'\bl\.p===0', 'l.p===V()'), (r'\bl\.p!==0', 'l.p!==V()'),
    (r'q\.pid===0', 'q.pid===V()'),
    (r'const pid=0,', 'const pid=V(),'), (r'const me=0,', 'const me=V(),'),
]
for pat, new in subs:
    ui, c = re.subn(pat, new, ui)
    print(f'{c:3d}  {pat}')
src = src[:a] + ui + src[b:]

# ---------------------------------------------------------------- Pass & Play screens (inside the UI closure, before start())
PP_JS = r"""
// ---------- Pass & Play (hot seat: Player 1..N on one device) ----------
// Players 0..H-1 are human, the rest are bots. Between two humans an opaque cover hides the board until the next player taps.
function ppHandoff(){
  if(!g||!g.pp||g.over) return;
  const pid=g.cur, p=g.players[pid]; if(!p||p.ai) return;
  sel=null; reach=null; targets=[]; drench=[]; pending=null; rollPath=null; closeModal();
  const old=document.getElementById('ppCover'); if(old) old.remove();
  const ov=document.createElement('div'); ov.id='ppCover';
  ov.style.cssText='position:fixed;inset:0;z-index:99999;background:#0b1620;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;text-align:center;padding:24px;color:#e8f1f7';
  const tr=TRIBES[p.tribe];
  ov.innerHTML=`<div style="opacity:.6;font-size:14px">턴 ${g.turn}</div>
    <div style="font-size:34px;font-weight:700"><span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${tr.col};margin-right:10px;vertical-align:middle"></span>Player ${pid+1}</div>
    <div style="font-size:18px">${tr.n}</div>
    <div style="opacity:.8;line-height:1.6">화면을 Player ${pid+1}에게 넘겨주세요.<br>다른 사람이 보지 않는지 확인한 뒤 시작하세요.</div>
    <button class="pri" id="ppGo" style="font-size:18px;padding:14px 28px">내 차례 시작</button>`;
  document.body.appendChild(ov);
  $('ppGo').onclick=()=>{
    ov.remove(); g.view=pid; updateVision(g); busy=false;
    const c=g.cities.find(c=>c.owner===pid&&c.capital)||g.cities.find(c=>c.owner===pid); if(c) centerOn(c.x,c.y);
    save(); refresh(); if(!checkOffers()) checkPending(); };
}
function ppOffer(a,b){ // human -> human peace proposal: delivered when the other player's turn starts
  if(!has(g,a,'strategy')||atPeace(g,a,b)) return {ok:false,why:'Strategy 필요'};
  const d=ddir(g,a,b); if(d.offered===g.turn) return {ok:false,why:'이번 턴에 이미 제안함'};
  d.offered=g.turn;
  if(dsym(g,a,b).state==='war') return {ok:false,why:'지금은 전쟁 중이라 거절 (최근 공격)'};
  (g.offers||(g.offers=[])).push({from:a,to:b,turn:g.turn}); return {ok:true};
}
function ppOver(){
  save(); const st=standings(g);
  const w=g.winner!=null&&g.winner>=0?g.players[g.winner]:null;
  const nm=i=>g.players[i].ai?tribeName(i):`Player ${i+1} · ${TRIBES[g.players[i].tribe].n}`;
  openModal(`<h2>${w?`${nm(g.winner)} 승리!`:'게임 종료'}</h2><p class="lead">${g.turn}턴 · ${w?'마지막까지 살아남았어요.':'사람 플레이어가 모두 탈락했어요.'}</p>
    <div class="loglist">${st.map((s,k)=>`<div><span class="t">${k+1}</span><span class="dot" style="display:inline-block;background:${TRIBES[g.players[s.pid].tribe].col}"></span> ${nm(s.pid)} · ${s.alive?s.score+'점':'탈락'}</div>`).join('')}</div>
    <div class="row"><button class="pri" id="mNew">새 게임</button><button id="mView">맵 보기</button></div>`);
  $('mNew').onclick=()=>{ try{localStorage.removeItem(SAVE);}catch(e){} setup(); }; $('mView').onclick=closeModal;
}
"""
rep("function start(){\n  GAMEID++;", PP_JS + "function start(){\n  GAMEID++;")

# ---------------------------------------------------------------- setup screen
rep("dom:true,off:true};", "dom:true,off:true,pp:false,humans:2,ppTribes:[-1,-1,-1,-1,-1]};")
rep("st.bots=Math.min(st.bots,maxBots(st.size)); fixBots();",
    "if(!Array.isArray(st.ppTribes)) st.ppTribes=[-1,-1,-1,-1,-1]; st.humans=Math.max(2,Math.min(6,maxBots(st.size)+1,+st.humans||2)); st.bots=Math.min(st.bots,Math.max(0,maxBots(st.size)-(st.pp?st.humans-1:0))); fixBots();")
rep("const mb=maxBots(st.size);", "const mb=Math.max(0,maxBots(st.size)-(st.pp?st.humans-1:0));")

PP_UI = """      <label class="tog"><input type="checkbox" id="sPP" ${st.pp?'checked':''}> Pass & Play (한 기기로 여러 명) <small>Player 1, 2, 3…이 번갈아 한 화면을 돌려 써요. 차례가 넘어갈 때 화면을 가려 안개 속 정보를 지켜요. 레이팅에는 반영되지 않아요.</small></label>
      ${st.pp?`<div class="lbl">사람 수 <b style="color:var(--fg)">${st.humans}명</b> <span style="text-transform:none;letter-spacing:0">(Player 1은 위에서 고른 부족)</span></div>
        <div class="row">${[2,3,4,5,6].filter(n=>n<=maxBots(st.size)+1).map(n=>`<button data-hum="${n}" class="${st.humans===n?'on':''}">${n}명</button>`).join('')}</div>
        <div class="bots" style="display:flex;flex-direction:column;gap:6px;margin:6px 0 14px">${Array.from({length:st.humans-1},(_,i)=>`<div class="botrow" style="grid-template-columns:auto auto minmax(0,1fr)"><span class="bn">Player ${i+2}</span><span class="dot" style="background:${st.ppTribes[i]>=0?TRIBES[st.ppTribes[i]].col:'transparent'};border-style:${st.ppTribes[i]>=0?'solid':'dashed'};border-color:var(--mute)"></span>
          <select data-pt="${i}" aria-label="Player ${i+2} 부족"><option value="-1">랜덤</option>${TRIBES.map((t,k)=>`<option value="${k}" ${st.ppTribes[i]===k?'selected':''}>${t.n}${t.sp?' (special)':''}</option>`).join('')}</select></div>`).join('')}</div>`:''}
"""
rep("""      <label class="tog"><input type="checkbox" id="sDom" """, PP_UI + """      <label class="tog"><input type="checkbox" id="sDom" """)
rep("$('sSpec').onchange=e=>{ st.spec=e.target.checked; keep(); };",
    "$('sSpec').onchange=e=>{ st.spec=e.target.checked; if(st.spec) st.pp=false; keep(); };\n    $('sPP').onchange=e=>{ st.pp=e.target.checked; if(st.pp) st.spec=false; keep(); };\n    sh.querySelectorAll('[data-hum]').forEach(b=>b.onclick=()=>{ st.humans=+b.dataset.hum; keep(); });\n    sh.querySelectorAll('[data-pt]').forEach(e=>e.onchange=()=>{ st.ppTribes[+e.dataset.pt]=+e.value; keep(); });")

rep("""      const taken=new Set([st.tribe,...bl.filter(b=>b.tribe>=0).map(b=>b.tribe)]);
      const pool=TRIBES.map((t,i)=>i).filter(i=>!taken.has(i)).sort(()=>Math.random()-.5);
      const tribes=bl.map(b=>b.tribe>=0?b.tribe:(pool.length?pool.shift():(Math.random()*TRIBES.length)|0)); // random picks use up unused tribes first, then repeat
      g=newGame({size:st.size,tribes:[st.tribe,...tribes],diff:st.diff,diffs:bl.map(b=>b.diff),mapType:st.map,noBotBonus:!!st.off,domination:!!st.dom,solo:st.bots===0});""",
"""      const H=st.pp?st.humans:1, hl=[st.tribe]; for(let i=1;i<H;i++) hl.push(st.ppTribes[i-1]);
      const taken=new Set([...hl.filter(t=>t>=0),...bl.filter(b=>b.tribe>=0).map(b=>b.tribe)]);
      const pool=TRIBES.map((t,i)=>i).filter(i=>!taken.has(i)).sort(()=>Math.random()-.5);
      const pick=t=>t>=0?t:(pool.length?pool.shift():(Math.random()*TRIBES.length)|0); // random picks use up unused tribes first, then repeat
      const humanT=hl.map(pick), tribes=bl.map(b=>pick(b.tribe));
      g=newGame({size:st.size,tribes:[...humanT,...tribes],humans:H,diff:st.diff,diffs:bl.map(b=>b.diff),mapType:st.map,noBotBonus:!!st.off,domination:!!st.dom,solo:st.bots===0&&H===1});
      if(H>1) g.noReview=true;""")

# ---------------------------------------------------------------- unofficial-fan-project notice (setup screen)
rep("""<div class="row"><button class="pri" id="sGo">게임 시작</button></div>""",
    """<div class="row"><button class="pri" id="sGo">게임 시작</button></div>
      <p class="note" style="margin-top:14px;text-align:center"><b>NOT AN OFFICIAL Polytopia PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MIDJIWAN.</b><br>비공식 팬 프로젝트이며 Midjiwan과 무관하고 승인받지 않았습니다.</p>""")

# ---------------------------------------------------------------- deep link: polytopia/#bot=lunaris | terranion14 pre-selects that bot (one-shot)
rep("  if(!Array.isArray(st.botList)) st.botList=[];\n  const fixBots=",
    "  if(!Array.isArray(st.botList)) st.botList=[];\n  { const hb=(location.hash.match(/bot=(\\w+)/)||[])[1]; if(hb&&DIFFS[hb]&&!DIFFS[hb].hide){ st.diff=hb; st.botList=[]; try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} } }\n  const fixBots=")

# ---------------------------------------------------------------- Solaris (learned policy) — page script + UI hooks
import os, json
SOL_JS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'solaris_page.js'), encoding='utf8').read()
assert '</script>' not in SOL_JS
SOL_NET = json.dumps(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'solaris_net.json'), encoding='utf8')), separators=(',', ':'))
assert '</script' not in SOL_NET
rep("</script>\n\n<script>\n'use strict';", "</script>\n<script type=\"application/json\" id=\"solarisNet\">" + SOL_NET + "</script>\n<script id=\"solaris\">\n" + SOL_JS + "</script>\n\n<script>\n'use strict';")

SOL_UI = r"""
// ---------- Solaris bot turn: decisions are sliced into ~40 ms chunks so the page stays responsive ----------
function solBotTurn(g,pid,cb){
  const myId=GAMEID, eb=$('endBtn'), nm=TRIBES[g.players[pid].tribe].n, t0=Date.now();
  if(!SOL.net){ toast('Solaris 가중치가 없어 이번 턴은 Lunaris가 대신 둬요',3200); try{ aiTurnCore(g,pid); }catch(e){ console.error(e); } cb(); return; }
  const st=SOL.begin(g,pid); let fired=false;
  const tick=()=>{
    if(myId!==GAMEID){ SOL.finish(g,st); return; }
    try{ const t1=Date.now(); while(Date.now()-t1<40){ if(SOL.act(g,st)==='end'){ if(!fired){ fired=true; SOL.finish(g,st); cb(); } return; } } }
    catch(e){ console.error(e); if(!fired){ fired=true; SOL.finish(g,st); try{ aiTurnCore(g,pid); }catch(e2){} cb(); } return; }
    eb.textContent=`${nm} Solaris ${Math.round((Date.now()-t0)/1000)}초`; setTimeout(tick,0);
  };
  tick();
}
"""
rep("function start(){\n  GAMEID++;", SOL_UI + "function start(){\n  GAMEID++;")
rep("      if(g.spectate && typeof Worker!=='undefined' && !SPEC.noWorker){ specBotTurn(g,who,watch,after); return; }",
    "      if(diffOf(g,who).sol){ solBotTurn(g,who,after); return; }\n      if(g.spectate && typeof Worker!=='undefined' && !SPEC.noWorker){ specBotTurn(g,who,watch,after); return; }")

# ---------------------------------------------------------------- product name
rep("<title>Virtual Polytopia</title>", "<title>AItopia</title>")
rep("<h2>Virtual Polytopia</h2>", "<h2>AItopia</h2>")

open(sys.argv[2], 'w', encoding='utf8').write(src)
print('edits:', n_edit, '->', sys.argv[2])
