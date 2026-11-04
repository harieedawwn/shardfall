# dev helper: python3 tools/addlang.py  -- appends KEYS to both language files (skips existing keys)
import json, re, sys
KEYS = json.load(open(sys.argv[1], encoding='utf-8'))
for lang in ('vi', 'en'):
    p = f'src/lang/{lang}.js'; s = open(p, encoding='utf-8').read()
    add = [k for k in KEYS if f'"{k}":' not in s]
    if not add: continue
    i = s.rindex('\n  };')
    body = s[:i].rstrip()
    body += ',\n' + ',\n'.join(f'    {json.dumps(k)}: {json.dumps(KEYS[k][lang], ensure_ascii=False)}' for k in add)
    open(p, 'w', encoding='utf-8').write(body + s[i:])
    print(lang, len(add))
