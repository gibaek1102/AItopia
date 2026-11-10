#!/usr/bin/env python3
"""Public build: spectator (bot vs bot) + live-game analysis only.
Removes the human-play entry points (single player, Pass & Play) from an AItopia build.
Usage: python3 patch_public.py <in.html> <out.html> <en|ko>
Every edit asserts how many times its anchor occurs, so a changed source fails loudly."""
import re, sys

src = open(sys.argv[1], encoding='utf8').read()
lang = sys.argv[3]
MODE = sys.argv[4] if len(sys.argv) > 4 else 'spec'   # 'spec' = bot-vs-bot spectator only, 'adv' = live-game analysis only
n = 0

def rep(old, new, count=1):
    global src, n
    c = src.count(old)
    assert c == count, f'expected {count}, found {c}: {old[:100]!r}'
    src = src.replace(old, new); n += 1

def rep_re(pat, new, count=1, flags=0):
    global src, n
    ms = re.findall(pat, src, flags)
    assert len(ms) == count, f'expected {count}, found {len(ms)}: {pat[:100]!r}'
    src = re.sub(pat, lambda m: new, src, flags=flags); n += 1

T = {
 'en': dict(lead='Bot-vs-bot spectator &amp; live-game analysis', tribe='Bot 1 tribe', go='Start spectating',
            blocked='This build only supports spectating bot games'),
 'ko': dict(lead='봇 대 봇 관전 · 실전 분석', tribe='봇 1 부족', go='관전 시작',
            blocked='이 빌드는 봇 대 봇 관전만 지원합니다'),
}[lang]

# 1) every path that begins a game (new / continue / load slot / import) goes through start(): refuse anything that is not a spectator game
rep("function start(){\n  GAMEID++;",
    "function start(){\n  if(!g.spectate && !ADVM){ toast(%r,3000); g=null; setup(); return; } // public build: no human play\n  GAMEID++;" % T['blocked'])

# 2) setup screen: spectator is forced, human-play options are removed
rep("spec:false,specDiff:'lunaris'", "spec:true,specDiff:'lunaris'")
rep("if(p) Object.assign(st,p); }catch(e){}", "if(p) Object.assign(st,p); }catch(e){}\n  st.spec=true; st.pp=false; st.humans=1;")
rep("if(!Array.isArray(st.ppTribes)) st.ppTribes=[-1,-1,-1,-1,-1];", "st.spec=true; st.pp=false; if(!Array.isArray(st.ppTribes)) st.ppTribes=[-1,-1,-1,-1,-1];")
# spectator checkbox (one line)
rep_re(r'\n[ \t]*<label class="tog"><input type="checkbox" id="sSpec"[^\n]*</label>', '')
# Pass & Play checkbox + its sub-section: everything up to the "capture every capital" toggle
i = src.index('<label class="tog"><input type="checkbox" id="sPP"'); j = src.index('<label class="tog"><input type="checkbox" id="sDom"')
assert 0 < i < j
src = src[:i] + src[j:]; n += 1
# their handlers
rep_re(r"\n[ \t]*\$\('sSpec'\)\.onchange=[^\n]*", '')
rep_re(r"\n[ \t]*\$\('sPP'\)\.onchange=[^\n]*", '')
# a saved human game must not be offered for "Continue"
rep("${saved&&!saved.over?", "${saved&&!saved.over&&saved.spectate?")
# wording
rep_re(r'<p class="lead">[^<]*<b style="color:var\(--fg\)">\$\{myElo\(\)\.r\}</b></p>', '<p class="lead">%s</p>' % T['lead'])
rep_re(r'<div class="lbl">[^<]*</div><div class="grid tribes" style="margin:6px 0 14px">\$\{tr\}</div>', '<div class="lbl">%s</div><div class="grid tribes" style="margin:6px 0 14px">${tr}</div>' % T['tribe'])
rep_re(r'id="sGo">[^<]*</button>', 'id="sGo">%s</button>' % T['go'])

# 3) Pass & Play UI code: replace with inert stubs (the engine branches are gated on g.pp, which is now always 0)
a = src.index('// ---------- Pass & Play'); b = src.index('// ---------- Solaris bot turn')
assert a < b
src = src[:a] + src[b:]; n += 1


# 4) wording: the first seat is simply "Bot 1", the others continue from 2
W = {'en': dict(seat='Bot 1', tribe='Bot 1 tribe', others='Other bots', aria='Difficulty of bot 1', n="Bot ${i+2}", bn='Bot ${i+1}'),
     'ko': dict(seat='봇 1', tribe='봇 1 부족', others='나머지 봇', aria='봇 1 난이도', n='봇 ${i+2}', bn='봇 ${i+1}')}[lang]
if lang == 'en':
    rep('<span class="bn">My seat\'s bot</span>', '<span class="bn">%s</span>' % W['seat'])
    rep('aria-label="Difficulty of my seat\'s bot"', 'aria-label="%s"' % W['aria'])
    rep('<div class="lbl">Opponents</div>', '<div class="lbl">%s</div>' % W['others'])
else:
    rep('<span class="bn">내 자리 봇</span>', '<span class="bn">%s</span>' % W['seat'])
    rep('aria-label="내 자리 봇 난이도"', 'aria-label="%s"' % W['aria'])
    rep('<div class="lbl">상대 지정</div>', '<div class="lbl">%s</div>' % W['others'])
rep('<span class="bn">%s</span><span class="dot"' % W['bn'], '<span class="bn">%s</span><span class="dot"' % W['n'])

# 5) every Terranion bot gets its own thinking time: a fixed small spread around the chosen time (x0.85 .. x1.15)
rep("function terrBotTurn(g,pid,cb){\n  const ms=g.terrMs||DIFFS.terranion.ms,",
    "const TF=[1,0.9,1.1,0.85,1.15,0.95,1.05,0.8];\nfunction terrMsFor(g,pid){ return Math.max(1000,Math.round((g.terrMs||DIFFS.terranion.ms)*TF[pid%TF.length])); }\nfunction terrBotTurn(g,pid,cb){\n  const ms=terrMsFor(g,pid),")
rep("terrMs:gg.terrMs||0}", "terrMs:terrMsFor(gg,pid)}")


# 6) remove the remaining single-player / Pass & Play code paths outright (not just guarded)
rep("const H=Math.max(1,opts.humans||1); const g={pp:H>1?H:0,view:0,solo:!!opts.solo,", "const H=1; const g={view:0,")
i = src.index("  if (g.pp){ // Pass & Play: ends when"); j = src.index("  else if (g.spectate){ if (alive.length<=1)", i)
src = src[:i] + "  if (g.spectate){ if (alive.length<=1)" + src[j+len("  else if (g.spectate){ if (alive.length<=1)"):]; n += 1
rep("else if (alive.length===1 && !g.solo) g.over='win'; // solo (0 bots): economy/training sandbox, no victory", "else if (alive.length===1) g.over='win';")
rep("else if (g.domination && !g.solo){", "else if (g.domination){")
rep("g.over==='win'&&!g.solo?", "g.over==='win'?")
rep_re(r"\+\(g\.pp\?` · P\$\{V\(\)\+1\}`:''\)", "")
rep("(g.spectate || (!g.pp && g.players[V()].alive))", "(g.spectate || g.players[V()].alive)")
rep("if(g.pp){ if(!g.over) ppHandoff(); } else if(!g.over && g.cur===V()) reviewStart(g,V());", "if(!g.over && g.cur===V()) reviewStart(g,V());")
rep("if(ev.length && !g.pp) toast", "if(ev.length) toast")
rep("!g.over && !g.pp && !checkOffers()", "!g.over && !checkOffers()")
rep("  if(g.pp){ ppOver(); return; }\n", "")
rep("g.log.filter(l=>!g.pp||l.p===V()||l.p<0).slice(-80)", "g.log.slice(-80)")
rep_re(r"hum=g\.pp&&!g\.players\[tid\]\.ai, r=hum\?ppOffer\(V\(\),tid\):proposePeace", "r=proposePeace")
rep_re(r"\(hum\?'[^']*':('[^']*')\)", r"\1") if False else None
m = re.search(r"\(hum\?'[^']*':('[^']*')\)", src); assert m
src = src[:m.start()] + m.group(1) + src[m.end():]; n += 1
rep("if(!g||ADVM||g.pp){", "if(!g||ADVM){")
rep("if(!g.pp&&!g.spectate&&!ADVM){", "if(!g.spectate&&!ADVM){")
rep("else if(g.pp){ if(!g.over) ppHandoff(); } else if(!g.over && !g._rv)", "else if(!g.over && !g._rv)")
# setup handler: one human seat only, no solo / multi-human options
rep("const H=st.pp?st.humans:1, hl=[st.tribe]; for(let i=1;i<H;i++) hl.push(st.ppTribes[i-1]);", "const H=1, hl=[st.tribe];")
rep("humans:H,diff:st.diff,", "diff:st.diff,")
rep(",solo:st.bots===0&&H===1});", "});")
rep("      if(H>1) g.noReview=true;\n", "")
# a bot-vs-bot game needs at least one other bot (0 bots was the single-player economy sandbox)
rep('id="sBots" type="range" min="0"', 'id="sBots" type="range" min="1"')
rep_re(r"\$\{st\.bots===0\?' [^']*':''\}", "")
rep("st.spec=true; st.pp=false; st.humans=1;", "st.spec=true; st.pp=false; st.humans=1; st.bots=Math.max(1,+st.bots||1);")
for bad in ('g.pp','ppHandoff','ppOffer','ppOver','g.solo','opts.humans'):
    assert bad not in src, bad

# 7) dead Pass & Play setup remnants
rep_re(r"\n[ \t]*sh\.querySelectorAll\('\[data-hum\]'\)[^\n]*", '')
rep_re(r"\n[ \t]*sh\.querySelectorAll\('\[data-pt\]'\)[^\n]*", '')
rep("const mb=Math.max(0,maxBots(st.size)-(st.pp?st.humans-1:0));", "const mb=Math.max(1,maxBots(st.size));", count=1)
rep_re(r"\+\(st\.bots===0\?' \([^)]*\)':''\)", "")

# 8) no manual save slots on the start screen
rep_re(r'<button id="sLoad">[^<]*</button>', '')
rep_re(r"\n[ \t]*\$\('sLoad'\)\.onclick=[^\n]*", '')

if MODE == 'spec':
    # live-game analysis lives in its own build
    rep_re(r'<button id="sAdv" class="pri">[^<]*</button>', '')
    rep_re(r"\n[ \t]*\$\('sAdv'\)\.onclick=[^\n]*", '')
    LEAD = {'en': 'Bot-vs-bot spectator', 'ko': '봇 대 봇 관전'}[lang]
    rep('<p class="lead">%s</p>' % T['lead'], '<p class="lead">%s</p>' % LEAD)
    # one bot list: Bot 1 is simply the first row (tribe + difficulty), the slider counts all bots
    rep_re(r'<div class="lbl">%s</div><div class="grid tribes" style="margin:6px 0 14px">\$\{tr\}</div>\n?' % re.escape(T['tribe']), '')
    rep_re(r"\n[ \t]*sh\.querySelectorAll\('\[data-tr\]'\)[^\n]*st\.tribe=\+b\.dataset\.tr[^\n]*", '')
    rep_re(r'<div class="botrow" style="grid-template-columns:auto minmax\(0,1fr\)"><span class="bn">[^<]*</span><select id="sSpecD".*?</select></div>\n[ \t]*', '', flags=re.S)
    rep_re(r"\n[ \t]*if\(\$\('sSpecD'\)\) \$\('sSpecD'\)\.onchange=[^\n]*", '')
    rep("const mb=Math.max(1,maxBots(st.size));", "const mb=Math.max(1,maxBots(st.size))+1;")
    rep('id="sBots" type="range" min="1" max="${mb}" value="${st.bots}"', 'id="sBots" type="range" min="2" max="${mb}" value="${st.bots+1}"')
    m = re.search(r'(<b id="sBotsL"[^>]*>)\$\{st\.bots\}', src); assert m
    src = src[:m.start()] + m.group(1) + '${st.bots+1}' + src[m.end():]; n += 1
    rep("st.bots=+sb.value; $('sBotsL').textContent=st.bots+", "st.bots=+sb.value-1; $('sBotsL').textContent=(st.bots+1)+")
    src = src.replace('<div class="lbl">%s</div>\n      <div class="bots"' % W['others'], '<div class="bots"'); n += 1
    rep('${st.botList.slice(0,st.bots).map((b,i)=>{', '${[{tribe:st.tribe,diff:st.specDiff},...st.botList.slice(0,st.bots)].map((b,j)=>{ const i=j-1;')
    rep_re(r'aria-label="(Bot|봇) \$\{i\+1\}', 'aria-label="%s ${i+2}' % ('Bot' if lang == 'en' else '봇'), count=2)
    rep("st.botList[+e.dataset.bt].tribe=+e.value;", "{ const k=+e.dataset.bt; if(k<0) st.tribe=+e.value; else st.botList[k].tribe=+e.value; }")
    rep("st.botList[+e.dataset.bd].diff=e.value;", "{ const k=+e.dataset.bd; if(k<0) st.specDiff=e.value; else st.botList[k].diff=e.value; }")
    rep("st.botList.forEach(o=>o.tribe=-1); keep();", "st.tribe=-1; st.botList.forEach(o=>o.tribe=-1); keep();")
    rep("if(k==='diff') st.botList.forEach(o=>o.diff=v);", "if(k==='diff'){ st.botList.forEach(o=>o.diff=v); st.specDiff=v; }")

    # bots weaker than Max are not offered
    for k, nm in [('easy','Easy'),('normal','Normal'),('hard','Hard'),('crazy','Crazy'),('super','Super'),('ultra','Ultra'),('hyper','Hyper'),('max','Max')]:
        rep("\n  %s:{n:'%s'," % (k, nm), "\n  %s:{hide:1,n:'%s'," % (k, nm))
    rep("if(!DIFFS[st.diff]) st.diff='crazy';", "if(!DIFFS[st.diff]||DIFFS[st.diff].hide) st.diff='lunaris'; if(!DIFFS[st.specDiff]||DIFFS[st.specDiff].hide) st.specDiff='lunaris';")
    rep("if(!DIFFS[b.diff]) b.diff='crazy';", "if(!DIFFS[b.diff]||DIFFS[b.diff].hide) b.diff='lunaris';")
    rep("const st={tribe:0,bots:2,diff:'crazy',", "const st={tribe:0,bots:2,diff:'lunaris',")

    # the original game counts turns from 0: show turn-1 everywhere in the spectator UI (internal turn counter and the turn limit are unchanged)
    for old, new in [("${g.turn}", "${g.turn-1}"), ("${saved.turn}", "${saved.turn-1}"), ("${m.turn}", "${m.turn-1}"), ('<span class="t">T${l.t}</span>', '<span class="t">T${l.t-1}</span>')]:
        assert src.count(old) >= 1, old
        src = src.replace(old, new); n += 1
else:
    # analysis-only build: boots straight into live-game analysis, no way back to the game
    rep("function setup(){\n", "function setup(){ advSetup(); return;\n")
    rep("m=localStorage.getItem('vpoly-mode');", "m='adv';")
    rep("  else setup(); }\nwindow.__advT", "  else advSetup(); }\nwindow.__advT")
    rep_re(r'<button id="mExit" class="warn">[^<]*</button>', '')
    rep_re(r"\$\('mExit'\)\.onclick = \(\) => \{ try \{ localStorage\.setItem\('vpoly-mode', 'game'\); \} catch \(e\) \{\} location\.reload\(\); \};", '')

# 9) language option inside the demo: a small switch to the sibling-language file (same folder), remembered for the redirect page
other = 'en' if lang == 'ko' else 'ko'
label = 'English' if lang == 'ko' else '한국어'
name = 'spectator' if MODE == 'spec' else 'analysis'
sw = ('<a id="aitLang" href="%s_%s.html" onclick="try{localStorage.setItem(\'ait-lang\',\'%s\')}catch(e){}" '
      'style="position:fixed;left:8px;bottom:8px;z-index:40;font:600 12px system-ui,sans-serif;color:#e6edf3;background:rgba(15,23,42,.82);'
      'border:1px solid rgba(148,163,184,.4);border-radius:999px;padding:5px 11px;text-decoration:none" lang="%s">%s</a>\n') % (name, other, other, other, label)
assert src.count('</body>') == 1
src = src.replace('</body>', sw + '</body>'); n += 1

# 10) version label
rep("n: 'Solaris 1β'", "n: 'pre-Solaris'")
rep("// 1β: 30 pairs", "// pre-Solaris: 30 pairs")
rep("eb.textContent=`${nm} Solaris ${Math.round(", "eb.textContent=`${nm} pre-Solaris ${Math.round(")
src = src.replace("No Solaris weights, so Lunaris plays", "No pre-Solaris weights, so Lunaris plays")

open(sys.argv[2], 'w', encoding='utf8').write(src)
print(f'{lang}: {n} edits ->', sys.argv[2], len(src))
