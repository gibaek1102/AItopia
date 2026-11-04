#!/usr/bin/env python3
"""Remove JS/CSS/HTML comments that contain Korean from an HTML page (string literals and markup are left alone).
A small tokenizer keeps strings, template literals and regex literals apart from real comments.
Usage: python3 strip_ko_comments.py in.html out.html"""
import re, sys

KO = re.compile(r'[가-힣]')
REGEX_PREV = set('(,=:[!&|?{};+-*%<>~^')


REGEX_PREV_SET = set('(,=:[!&|?{};+-*%<>~^')
def regex_ok(code, k, lo):
    p = k - 1
    while p >= lo and code[p].isspace(): p -= 1
    return p < lo or code[p] in REGEX_PREV_SET
def skip_regex(code, k):
    n = len(code); j = k + 1; cls = False
    while j < n and code[j] != '\n':
        if code[j] == '\\': j += 2; continue
        if code[j] == '[': cls = True
        elif code[j] == ']': cls = False
        elif code[j] == '/' and not cls: return j
        j += 1
    return j

def strip_js(code):
    out = []; i = 0; n = len(code); stack = []      # stack of template-literal brace depths
    prev_sig = ''                                   # last significant (non-space) char outside comments, for regex detection
    prev_word = ''
    def emit(s): out.append(s)
    while i < n:
        c = code[i]; nx = code[i + 1] if i + 1 < n else ''
        if c == '/' and nx == '/':
            j = code.find('\n', i); j = n if j < 0 else j
            cm = code[i:j]
            if KO.search(cm):
                # drop the comment and the spaces before it
                while out and out[-1] and out[-1][-1] in ' \t' and out[-1].strip() == '': out.pop()
                if out and out[-1] and out[-1][-1] in ' \t': out[-1] = out[-1].rstrip(' \t')
            else: emit(cm)
            i = j; continue
        if c == '/' and nx == '*':
            j = code.find('*/', i + 2); j = n - 2 if j < 0 else j
            cm = code[i:j + 2]
            if not KO.search(cm): emit(cm)
            i = j + 2; continue
        if c in '\'"':
            j = i + 1
            while j < n and code[j] != c:
                j += 2 if code[j] == '\\' else 1
            emit(code[i:j + 1]); i = j + 1; prev_sig = c; prev_word = ''; continue
        if c == '`':
            # copy the template literal; nested ${ ... } contain code (may hold strings / more templates) -> recurse by scanning to the matching brace
            j = i + 1; start = i
            while j < n and code[j] != '`':
                if code[j] == '\\': j += 2; continue
                if code[j] == '$' and code[j + 1:j + 2] == '{':
                    d = 1; j += 2
                    while j < n and d:
                        ch = code[j]
                        if ch in '\'"':
                            q = ch; j += 1
                            while j < n and code[j] != q: j += 2 if code[j] == '\\' else 1
                        elif ch == '`':
                            k = j + 1
                            while k < n and code[k] != '`': k += 2 if code[k] == '\\' else 1
                            j = k
                        elif ch == '/' and code[j + 1:j + 2] not in ('/', '*') and regex_ok(code, j, i):
                            j = skip_regex(code, j)
                        elif ch == '{': d += 1
                        elif ch == '}': d -= 1
                        j += 1
                    continue
                j += 1
            emit(code[start:j + 1]); i = j + 1; prev_sig = '`'; prev_word = ''; continue
        if c == '/':
            # division or regex literal?
            if prev_sig in REGEX_PREV or prev_sig == '' or prev_word in ('return', 'typeof', 'case', 'in', 'of'):
                j = i + 1; cls = False
                while j < n and code[j] != '\n':
                    if code[j] == '\\': j += 2; continue
                    if code[j] == '[': cls = True
                    elif code[j] == ']': cls = False
                    elif code[j] == '/' and not cls: break
                    j += 1
                emit(code[i:j + 1]); i = j + 1
                while i < n and code[i].isalpha(): emit(code[i]); i += 1
                prev_sig = '/'; prev_word = ''; continue
        if c.isspace(): emit(c); i += 1; continue
        if c.isalnum() or c in '_$':
            j = i
            while j < n and (code[j].isalnum() or code[j] in '_$'): j += 1
            prev_word = code[i:j]; prev_sig = 'a'; emit(prev_word); i = j; continue
        prev_sig = c; prev_word = ''; emit(c); i += 1
    return ''.join(out)

def main(inp, outp):
    h = open(inp, encoding='utf8').read()
    def script(m):
        return m.group(1) + strip_js(m.group(2)) + m.group(3)
    h = re.sub(r'(<script[^>]*>)([\s\S]*?)(</script>)', script, h)
    def style(m):
        return m.group(1) + re.sub(r'/\*[\s\S]*?\*/', lambda k: '' if KO.search(k.group(0)) else k.group(0), m.group(2)) + m.group(3)
    h = re.sub(r'(<style[^>]*>)([\s\S]*?)(</style>)', style, h)
    h = re.sub(r'<!--[\s\S]*?-->', lambda k: '' if KO.search(k.group(0)) else k.group(0), h)
    h = re.sub(r'[ \t]+\n', '\n', h)
    open(outp, 'w', encoding='utf8').write(h)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
