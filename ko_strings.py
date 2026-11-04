#!/usr/bin/env python3
"""Find / replace the Korean text of an HTML page at the level of whole string-literal contents.
  segments(html)               -> list of (kind, raw) for every distinct Korean-containing JS string / template part / HTML text run
  apply(html, translations)    -> html with each segment replaced (kind-aware escaping); asserts every segment has a translation
kinds: "'" '"' '`' (JS literals, `${}` expressions are walked recursively) and 'h' (HTML text/attributes outside <script>)."""
import re, sys, json

KO = re.compile(r'[가-힣]')


REGEX_PREV_SET = set('(,=:[!&|?{};+-*%<>~^')
def regex_ok(code, k, lo):
    p = k - 1
    while p >= lo and code[p].isspace(): p -= 1
    return p < lo or code[p] in REGEX_PREV_SET
def skip_regex(code, k):
    """k at the opening '/', returns index of the closing '/'"""
    n = len(code); j = k + 1; cls = False
    while j < n and code[j] != '\n':
        if code[j] == '\\': j += 2; continue
        if code[j] == '[': cls = True
        elif code[j] == ']': cls = False
        elif code[j] == '/' and not cls: return j
        j += 1
    return j

def walk(code, base, found):
    """collect (start, end, kind) of string contents containing Korean in `code` (positions are relative to code; base added)"""
    i = 0; n = len(code)
    def tmpl(j, kind_start):
        # j is index after the opening backtick; returns index after closing backtick
        seg = j
        while j < n and code[j] != '`':
            if code[j] == '\\': j += 2; continue
            if code[j] == '$' and code[j + 1:j + 2] == '{':
                if seg < j and KO.search(code[seg:j]): found.append((base + seg, base + j, '`'))
                # expression: find matching brace, recurse on its code
                d = 1; k = j + 2; es = k
                while k < n and d:
                    ch = code[k]
                    if ch in '\'"':
                        q = ch; k += 1
                        while k < n and code[k] != q: k += 2 if code[k] == '\\' else 1
                    elif ch == '`':
                        k = tmpl(k + 1, k) - 1
                    elif ch == '/' and code[k + 1:k + 2] not in ('/', '*') and regex_ok(code, k, es):
                        k = skip_regex(code, k)
                    elif ch == '{': d += 1
                    elif ch == '}': d -= 1
                    k += 1
                walk(code[es:k - 1], base + es, found)
                j = k; seg = j; continue
            j += 1
        if seg < j and KO.search(code[seg:j]): found.append((base + seg, base + j, '`'))
        return j + 1
    prev_sig = ''; prev_word = ''
    REGEX_PREV = set('(,=:[!&|?{};+-*%<>~^')
    while i < n:
        c = code[i]; nx = code[i + 1] if i + 1 < n else ''
        if c == '/' and nx == '/':
            j = code.find('\n', i); i = n if j < 0 else j; continue
        if c == '/' and nx == '*':
            j = code.find('*/', i + 2); i = n if j < 0 else j + 2; continue
        if c in '\'"':
            j = i + 1
            while j < n and code[j] != c: j += 2 if code[j] == '\\' else 1
            if KO.search(code[i + 1:j]): found.append((base + i + 1, base + j, c))
            i = j + 1; prev_sig = c; prev_word = ''; continue
        if c == '`':
            i = tmpl(i + 1, i); prev_sig = '`'; prev_word = ''; continue
        if c == '/' and (prev_sig in REGEX_PREV or prev_sig == '' or prev_word in ('return', 'typeof', 'case', 'in', 'of')):
            j = i + 1; cls = False
            while j < n and code[j] != '\n':
                if code[j] == '\\': j += 2; continue
                if code[j] == '[': cls = True
                elif code[j] == ']': cls = False
                elif code[j] == '/' and not cls: break
                j += 1
            i = j + 1
            while i < n and code[i].isalpha(): i += 1
            prev_sig = '/'; prev_word = ''; continue
        if c.isspace(): i += 1; continue
        if c.isalnum() or c in '_$':
            j = i
            while j < n and (code[j].isalnum() or code[j] in '_$'): j += 1
            prev_word = code[i:j]; prev_sig = 'a'; i = j; continue
        prev_sig = c; prev_word = ''; i += 1

def find_all(html):
    found = []
    spans = []                                    # script/style spans (not HTML text)
    for m in re.finditer(r'<(script|style)[^>]*>([\s\S]*?)</\1>', html):
        spans.append((m.start(2), m.end(2), m.group(1)))
        if m.group(1) == 'script': walk(m.group(2), m.start(2), found)
        else:
            for k in re.finditer(r'[^\n]*[가-힣][^\n]*', m.group(2)): found.append((m.start(2) + k.start(), m.start(2) + k.end(), 'css'))
    # HTML outside script/style: Korean runs
    pos = 0
    for a, b, _ in spans + [(len(html), len(html), '')]:
        chunk = html[pos:a]
        for k in re.finditer(r'[가-힣][^<>"]*', chunk): found.append((pos + k.start(), pos + k.end(), 'h'))
        pos = b
    found = sorted(set(found))                      # nested templates are reached twice (brace matching + recursion): keep each span once
    for (a1, b1, _), (a2, b2, _) in zip(found, found[1:]): assert a2 >= b1, f'overlapping segments {a1}-{b1} / {a2}-{b2}'
    return found

def segments(html):
    seen = {}; out = []
    for a, b, k in find_all(html):
        key = (k, html[a:b])
        if key not in seen: seen[key] = 1; out.append(key)
    return out

def esc(s, kind):
    if kind == "'": return s.replace("\\", "\\\\").replace("'", "\\'") if False else s.replace("'", "\\'") if "\\'" not in s else s
    if kind == '"': return s.replace('"', '\\"') if '\\"' not in s else s
    if kind == '`': return s.replace('`', '\\`') if '\\`' not in s else s
    return s

def apply(html, tr):
    out = []; pos = 0; miss = []
    for a, b, k in find_all(html):
        raw = html[a:b]; key = k + '\u0001' + raw
        if key not in tr: miss.append((k, raw)); continue
        out.append(html[pos:a]); out.append(esc(tr[key], k)); pos = b
    assert not miss, f'{len(miss)} segments without translation, e.g. {miss[:3]}'
    out.append(html[pos:]); return ''.join(out)

if __name__ == '__main__':
    h = open(sys.argv[1], encoding='utf8').read()
    segs = segments(h)
    json.dump([[k, r] for k, r in segs], open(sys.argv[2], 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    print(len(segs), 'segments,', sum(len(r) for _, r in segs), 'chars')
