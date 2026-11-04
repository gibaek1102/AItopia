#!/usr/bin/env python3
"""Full build: original Terranion HTML -> AItopia (Korean + English).
   python3 build.py <original.html> <outdir>
   steps: clean_fan -> patch_pp (Pass&Play, notice, Solaris, name) -> strip Korean comments -> KO page -> translate -> EN page"""
import subprocess, sys, os, re, json
here = os.path.dirname(os.path.abspath(__file__)); orig, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
sys.path.insert(0, here)
import ko_strings as K
def run(*a): subprocess.run([sys.executable, *a], check=True, cwd=here)
tmp = os.path.join(out, '_tmp'); os.makedirs(tmp, exist_ok=True)
run('clean_fan.py', orig, f'{tmp}/clean.html')
run('patch_pp.py', f'{tmp}/clean.html', f'{tmp}/pp.html')
run('strip_ko_comments.py', f'{tmp}/pp.html', f'{tmp}/nc.html')
def fix_doc(h, lang):
    h = h.replace('<!doctype html><html><head><meta charset=utf8>', f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8">', 1)
    return h
ko = fix_doc(open(f'{tmp}/nc.html', encoding='utf8').read(), 'ko')
tr = json.load(open(os.path.join(here, 'tr_dict.json'), encoding='utf8'))
en = K.apply(ko, tr)
for a, b in [("/^유적:\\s*/", "/^Ruins:\\s*/"), ("/베테랑/.test(m)", "/veteran/.test(m)"), ("/탐험가/.test(m)", "/explorer/.test(m)"),
             ("/인구/.test(m)", "/population/.test(m)"), ("/도시/.test(m)", "/city/.test(m)"),
             ("/점령|멸망|처치|전향|폭발/.test(l.m)", "/captured|destroyed|killed|convert|explo/.test(l.m)"), ('<html lang="ko">', '<html lang="en">')]:
    en = en.replace(a, b)
en = re.sub(r'^[ \t]*//[^\n]*[가-힣][^\n]*\n', '', en, flags=re.M)
left = set(re.findall(r'[가-힣]+', en)); assert not left, f'Korean left in English build: {left}'
open(os.path.join(out, 'index.html'), 'w', encoding='utf8').write(en)
open(os.path.join(out, 'index_ko.html'), 'w', encoding='utf8').write(ko)
print('built', out, len(en), len(ko))
