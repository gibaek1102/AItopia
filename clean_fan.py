#!/usr/bin/env python3
"""Remove the fan tribes (cyment's Ultimate / Darkness / Crusader / Shifr) and the home-made Marble tribe from the engine.
Usage: python3 clean_fan.py <in.html> <out.html>.  Every edit asserts that its anchor exists exactly once."""
import re, sys

src = open(sys.argv[1], encoding='utf8').read()
lines = src.split('\n')
log = []

def find(sub, start=0, count_unique=True):
    idx = [i for i in range(start, len(lines)) if sub in lines[i]]
    if count_unique: assert len(idx) == 1, f'expected 1 line with {sub[:70]!r}, found {len(idx)}'
    assert idx, f'missing {sub[:70]!r}'
    return idx[0]

def del_range(start_sub, end_sub, *, keep_end=False, tag=''):
    a = find(start_sub); b = next(i for i in range(a, len(lines)) if end_sub in lines[i])
    if keep_end: b -= 1
    n = b - a + 1; del lines[a:b + 1]; log.append(f'{tag or start_sub[:40]}: -{n} lines')

def del_line(sub, tag=''):
    a = find(sub); del lines[a]; log.append(f'line {tag or sub[:40]}')

def func_end_line(a):
    """index of the line where the function starting at lines[a] closes (brace scan that understands strings, templates, comments)"""
    text = '\n'.join(lines[a:]); i = 0; depth = 0; started = False; stack = []   # stack: template-literal nesting
    n = len(text)
    while i < n:
        c = text[i]
        if c == '/' and text[i+1:i+2] == '/':
            i = text.index('\n', i) if '\n' in text[i:] else n; continue
        if c == '/' and text[i+1:i+2] == '*':
            i = text.index('*/', i) + 2; continue
        if c in '\'"':
            q = c; i += 1
            while text[i] != q:
                i += 2 if text[i] == '\\' else 1
            i += 1; continue
        if c == '`':
            i += 1
            while True:
                if text[i] == '\\': i += 2; continue
                if text[i] == '`': i += 1; break
                if text[i] == '$' and text[i+1] == '{':          # nested expression: scan it recursively by depth counting
                    d = 1; i += 2
                    while d:
                        ch = text[i]
                        if ch in '\'"': 
                            q = ch; i += 1
                            while text[i] != q: i += 2 if text[i] == '\\' else 1
                        elif ch == '`':
                            # nested template inside ${}: skip it (rare); assume no further nesting
                            i += 1
                            while text[i] != '`': i += 2 if text[i] == '\\' else 1
                        elif ch == '{': d += 1
                        elif ch == '}': d -= 1
                        i += 1
                    continue
                i += 1
            continue
        if c == '{': depth += 1; started = True
        elif c == '}':
            depth -= 1
            if started and depth == 0: return a + text.count('\n', 0, i)
        i += 1
    raise AssertionError('unterminated function')

def rm_func(name):
    a = find(f'function {name}(')
    b = func_end_line(a)
    n = b - a + 1; del lines[a:b + 1]; log.append(f'func {name}: -{n}')

# ------------------------------------------------------------------ 1. big blocks
a = find('function unitStarCost('); b = next(i for i in range(a, len(lines)) if lines[i].rstrip().endswith('return s; }'))
lines[a:b + 1] = ['function unitStarCost(g,pid,type){ return UNITS[type].c||0; }']; log.append('unitStarCost simplified')
a = find('function payUnit('); b = next(i for i in range(a, len(lines)) if lines[i].rstrip().endswith('return true; }'))
lines[a:b + 1] = ['function payUnit(g,pid,type){ const p=g.players[pid], c=unitStarCost(g,pid,type); if (!(p.stars>=c)) return false; p.stars-=c; return true; }']; log.append('payUnit simplified')
del_range('// ---- fan tribes (cyment)', '});', tag='tech names T25')             # T25 + TECH_RENAME fan entries
del_range('// ===== fan tribes by cyment', '  cygnia:{', tag='fan units')
for name in ['oilSupply', 'meteorProd', 'templeNear', 'fanTurnStart', 'fanTurnEnd', 'fanInfiltrate',
             'mbRollable', 'mbOnRail', 'mbNext', 'mbExits', 'mbDepartDirs', 'mbOut', 'mbRollCore', 'mbRoll', 'mbRollAll', 'mbCollide', 'mbBoom',
             'mbLaunchInfo', 'mbToggle', 'mbSignalNear', 'mbTunExit', 'mbSeaTick', 'mbReach', 'mbRollmoveAdd', 'mbPath', 'mbShip', 'mbConnSet',
             'mbTileOptions', 'mbClearTrack', 'mbDoTile', 'mbUnitActions', 'mbAction', 'aiMbBuild', 'aiMbLay', 'aiMbDepart', 'fanTileOptions', 'fanInfoModal',
             'ddot', 'nbI', 'rotD', 'hasTrk', 'hitExtra', 'hasImp', 'countImp']:
    rm_func(name)

# marble data: tech list, tree helpers, unit table, skill names, per-tribe table entries, tile/action/AI tables
a = find('// ================= MARBLE ('); b = find('SUPER.mb=')
# keep the shared standard-tree helpers (STD_IDS / STD_BR / treeIds / branchesOf) in simplified form
std = [l for l in lines[a:b + 1] if l.startswith('const MB_IDS=MB_TECH') or l.startswith('const STD_BR') or l.startswith('function treeIds') or l.startswith('function branchesOf')]
assert len(std) == 4
repl = ['const STD_IDS=TECH_LIST.map(a=>a[0]);', 'const STD_BR=BRANCHES.map(([a,p,q])=>[a,[p,q]]);',
        'function treeIds(g,pid){ return STD_IDS; }', 'function branchesOf(g,pid){ return STD_BR; }']
del lines[a:b + 1]; lines[a:a] = repl; log.append(f'marble tables: -{b - a + 1 - len(repl)} lines')
for sub in ['REPL.mb=', 'EXTRA_UNLOCK.mb=', 'BLD.mb=', 'TEMPLE_N.mb=', 'const MB_TILE=', 'const MB_ACT=', 'const MB_AI=']:
    del_line(sub)
# directions helpers that only the marble code used
for sub in ['const OPP=DIRS.map']:
    del_line(sub)
# multi-line const tables
del_range('const BLD={', '};', tag='BLD'); del_line('const TEMPLE_N={'); del_line('const FAN_IMP={')
del_line('const FAN_SP={'); del_line('// ================= FAN TRIBE MECHANICS')
del_range('const FAN_B={', '};', tag='FAN_B'); del_range('const FAN_B0=', "chivalry:''};", tag='FAN_B0')

src = '\n'.join(lines)

def sub(old, new, count=1):
    global src
    c = src.count(old); assert c == count, f'expected {count} of {old[:80]!r}, found {c}'
    src = src.replace(old, new); log.append(f'sub {old[:48]!r}')

# ------------------------------------------------------------------ 2. table entries
sub(",ul:'colossus',dk:'merlin',cr:'general',sh:'cygnia'}", "}")
src, n = re.subn(r"\n  (ul|dk|cr|sh):\{warrior:'[^\n]*", '', src); assert n == 4; log.append('REPL fan rows -4')
sub("  ul:[['construction','titan']], dk:[], cr:[], sh:[],\n", "")
src, n = re.subn(r"const NAVAL=\{ul:[^\n]*\n", "const NAVAL={};\n", src); assert n == 1
src, n = re.subn(r"const BLD=\{[\s\S]*?\n\};\n", "", src); assert n in (0, 1)

# ------------------------------------------------------------------ 3. call sites
sub("function has(g,pid,t){ const tc=g.players[pid].tech; if (tc[t]) return true; const m=MB_EQ[t]; return !!(m && tc[m]); } // marble techs stand in for the standard feature (MB_EQ)",
    "function has(g,pid,t){ return !!g.players[pid].tech[t]; }")
sub("return !sp || sp==='el' || !!FAN_SP[sp]; }", "return !sp || sp==='el'; }")
sub("""  { const sp=spOf(g,pid);
    if (sp==='ul' && hasImp(g,pid,'generator')) s+=3*Math.floor(oilSupply(g,pid)/5);
    if (sp==='sh' && hasImp(g,pid,'mstore')) s+=3*Math.floor((g.players[pid].meteor||0)/10); }
""", "")
sub("  const mbSet = spOf(g,pid)==='mb' ? mbConnSet(g,pid) : null; // marble: loop connection over directed track, needs 신호\n", "")
sub("const on = mbSet ? mbSet.has(c.id) : !!seen[c.y*N+c.x];", "const on = !!seen[c.y*N+c.x];")
a = src.index("  if (spOf(g,pid)==='ul'){ // 철도"); b = src.index("  if (spOf(g,pid)==='mb') mbShip(g,pid);\n") + len("  if (spOf(g,pid)==='mb') mbShip(g,pid);\n")
src = src[:a] + src[b:]; log.append('rail + ship block removed')
sub(" && !FAN_SP[sp] && !cityHas('market')", " && !cityHas('market')")
sub("  if (FAN_SP[sp]) fanTileOptions(g,pid,x,y,t,out,own,cityHas);\n", "")
a = src.index("  if (MB_TILE.test(id) && spOf(g,pid)==='mb')"); b = src.index("\n", a) + 1; src = src[:a] + src[b:]
sub("const bump=(imp,per)=>{ if (spOf(g,pid)==='mb') return; nbrs(g,x,y,(a,b,q)=>{ if(q.imp===imp && q.cityOf>=0 && q.owner===t.owner){ const k=per*(spOf(g,pid)==='cr'&&templeNear(g,a,b)?2:1);",
    "const bump=(imp,per)=>{ nbrs(g,x,y,(a,b,q)=>{ if(q.imp===imp && q.cityOf>=0 && q.owner===t.owner){ const k=per;")
sub("bump('forge',spOf(g,pid)==='sh'?1:2)", "bump('forge',2)")
sub("  if (d.sk.has('roll')||d.sk.has('rail')) return mbReach(g,u);\n", "")
sub("  if (d.sk.has('rollmove')) mbRollmoveAdd(g,u,out);\n", "")
sub(" if (U(u).sk.has('roll') && CURG && mbOnRail(CURG,u)) return false;", "")
sub("  dmg+=hitExtra(g,d);\n", "")
sub("if (hasImp(g,k.owner,'papacy')){ const b2=Math.floor((UNITS[k.base].c||0)/2); g.players[k.owner].stars+=b2; log(g,`교황청: 승급 보상 +${b2}★`,k.owner); } }", "}")
sub(" && (!(d.sk.has('roll')||d.sk.has('rail')) || mbRollable(g,tile(g,ex,ey),u.owner))", "")
sub("  mbUnitActions(g,u,out);\n", "")
sub("  { const r=mbAction(g,u,id); if (r!==undefined){ if (r) updateVision(g); return r; } }\n", "")
sub("  if (U(u).sk.has('fire')||U(u).sk.has('wraith')||U(u).sk.has('blast')) return fanInfiltrate(g,u,c);\n", "")
sub("(sp==='mb'?'cannonraft':canPort(g,pid)?navType(g,pid,'rammer'):(sp==='aq'?'shark':sp==='cy'?'raychi':null))", "(canPort(g,pid)?navType(g,pid,'rammer'):(sp==='aq'?'shark':sp==='cy'?'raychi':null))")
sub("  fanTurnStart(g,p.id);\n", "")
sub("  mbRollAll(g,pid); // marble: rolling units roll along the track at the end of the owner's turn, in departure order\n", "")
sub("  fanTurnEnd(g,pid);\n", "")
src, n = re.subn(r"  if \(t\.startsWith\('mb_'\)\)\{[^\n]*\n", "", src); assert n == 1
a = src.index("        { const FS={oilform:"); b = src.index("continue; } }\n", a) + len("continue; } }\n"); src = src[:a] + src[b:]
sub("  if (d.sk.has('roll') && mbOnRail(g,u)){ aiTryAttack(g,u,ctx,false); if (g.units.includes(u)) aiMbDepart(g,u,ctx); return; }\n", "")
sub("  if (spOf(g,pid)==='mb'){ ctx=aiContext(g,pid); aiMbBuild(g,pid,ctx); }\n", "")
src, n = re.subn(r"  if \(sp && FAN_SP\[sp\]\)\{[^\n]*\n", "", src); assert n == 1
a = src.index("  // marble tracks: a line from the tile centre"); b = src.index("cx.fill(); } }\n", src.index("if(hasTrk(t)){ cx.fillStyle='#e6eaef'")) + len("cx.fill(); } }\n"); src = src[:a] + src[b:]
sub("  rollPath=null; if(u.owner===0 && UNITS[u.type].sk.has('roll')){ const ds=u.roll?[u.rdir]:mbDepartDirs(g,u); if(ds.length) rollPath=mbRollCore(g,u,ds[0]).path; }\n", "  rollPath=null;\n")
sub("tt===t || (sp==='mb' && tt && MB_EQ[tt]===t)", "tt===t")
sub("const bb=FAN_SP[sp]?((FAN_B[sp][t]!=null)?FAN_B[sp][t]:FAN_B0[t]):B[t];", "const bb=B[t];")
# per-tribe leftovers
sub("  const grp=k=>(spOf(g,pid)==='dk'&&(k==='port'||k==='gate'))?'gate':k;", "  const grp=k=>k;")
sub("  const gates = spOf(g,u.owner)==='dk' && !d.sk.has('naval') && !d.sk.has('water') ? g.tiles.reduce((a,t,i)=>{ if(t.imp==='gate'&&t.owner===u.owner) a.push(i); return a; },[]) : null;", "  const gates = null;")
a = src.index("    if (t.owner>=0 && t.owner!==u.owner && spOf(g,t.owner)==='dk'"); b = src.index("u.hidden=1; } }\n", a) + len("u.hidden=1; } }\n")
src = src[:a] + "  }\n" + src[b:]
sub("  { const t=tile(g,u.x,u.y); // stepping on a Darkness farm/lumber/mine confuses\n", "  { const t=tile(g,u.x,u.y);\n")
src, n = re.subn(r"  if \(owner>=0 && g\.players\[owner\] && TRIBES\[g\.players\[owner\]\.tribe\]\.sp==='mb'\) c\.ftrk=1;[^\n]*\n", "", src); assert n == 1
sub(" if (spOf(g,pid)==='mb') c.ftrk=1;", "")
sub(" && spOf(g,pid)!=='mb') for (const [tk,ty] of", ") for (const [tk,ty] of")
sub("case 'disband': if (spOf(g,pid)==='sh') p.meteor=(p.meteor||0)+(u.vet?5:u.kills); p.stars+=", "case 'disband': p.stars+=")
sub("const pk=sp==='mb'?'mb_pact':'meditation';", "const pk='meditation';")
sub("has(g,pid,sp==='mb'?'mb_eng':'trade')", "has(g,pid,'trade')")
sub("has(g,pid,spOf(g,pid)==='mb'?'mb_eng':'trade')", "has(g,pid,'trade')")
sub("  if (tr.sp === 'mb') return Object.keys(tc); // marble tree is different: leave as entered\n", "")
sub(" && TRIBES[p.tribe].sp !== 'mb') set.add(t);", ") set.add(t);")
sub("+(sp==='ul'?` 🛢${p.oil||0}`:sp==='sh'?` ☄${p.meteor||0}`:'')", "")
src, n = re.subn(r"  if\(t\.shp!=null && t\.owner>=0 && spOf\(g,t\.owner\)==='mb'[^\n]*\n", "", src); assert n == 1
src, n = re.subn(r"    if\(g\.cur===0 && t\.imp==='forge' && t\.owner===0 && spOf\(g,0\)==='dk'[^\n]*\n[^\n]*\n", "", src); assert n == 1
src, n = re.subn(r"if\(hasTrk\(t\)\) bits\.push\(`트랙[^\n]*?if\(t\.imp==='tramp'\) bits\.push\(`도약 방향 \$\{ARROW\[t\.tdir\]\}`\);", "", src); assert n == 1
sub("if (type==='raft' && pid!=null && g && g.players[pid] && spOf(g,pid)==='dk') return '베슬'; ", "")

sub(" || spOf(g,pid)==='mb')) return null; // marble: mountains only through tunnels", ")) return null;")
sub("&&canPort(g,pid)&&sp!=='mb'?((sp&&REPL[sp].warrior)", "&&canPort(g,pid)?((sp&&REPL[sp].warrior)")
src = src.replace(" && sp!=='dk' && sp!=='sh' && sp!=='cy'", " && sp!=='cy'").replace(" && sp !== 'dk' && sp !== 'sh' && sp !== 'cy'", " && sp !== 'cy'")
sub(", random tribes incl. fan tribes,", ", random tribes,")

open(sys.argv[2], 'w', encoding='utf8').write(src)
print('\n'.join(log)); print('written', sys.argv[2], len(src))
