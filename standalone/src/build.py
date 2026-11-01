import sys, json, os
D = os.path.dirname(os.path.abspath(__file__))
safe = lambda js: js.replace('</script', '<\\/script').replace('<!--', '<\\!--')
cfg = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else {}
order = ['core.js','i18n.js','he.js','he2.js','views1.js','views2.js','views3.js','actions.js','login.js','legal.js','platform.js']
app = '\n'.join(open(os.path.join(D, f)).read() for f in order if os.path.exists(os.path.join(D, f)))
lib = json.load(open(os.path.join(D, 'lib-seed.json')))
app = 'const LIB_SEED = ' + json.dumps(lib, ensure_ascii=False, separators=(',',':')) + ';\n' + app + '\nboot();\n'
sup = open(os.path.join(D, 'mock-sb.js')).read() if os.environ.get('MOCK') else open(os.path.join(D, '..', '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js')).read()
head = open(os.path.join(D, 'head.html')).read()
icon = "data:image/svg+xml," + "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='250 266 690 690'%3E%3Cpath d='M309 716A303 303 0 1 1 885 690' fill='none' stroke='%230b5a3a' stroke-width='53' stroke-linecap='round'/%3E%3Cpath d='M848 774A303 303 0 0 1 416 856' fill='none' stroke='%233fae4f' stroke-width='53'/%3E%3Cpolygon points='355,812 453,803 378,908' fill='%233fae4f'/%3E%3Crect x='473' y='626' width='68' height='90' rx='14' fill='%230b5a3a'/%3E%3Crect x='560' y='561' width='68' height='155' rx='14' fill='%230b5a3a'/%3E%3Crect x='647' y='496' width='68' height='220' rx='14' fill='%233fae4f'/%3E%3C/svg%3E"
out = f'''<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Performance360 Academy: training, testing, nutrition and payments for sports academies.">
<meta name="theme-color" content="#0b5a3a"><meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="icon" href="{icon}"><link rel="apple-touch-icon" href="{icon}">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}html,body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
<script>
/* ===== Configuration: the only part you edit ===== */
window.P360_CONFIG = {json.dumps(cfg, indent=2, ensure_ascii=False)};
</script>
</head><body>
{head}
<script>{safe(sup)}</script>
<script>{safe(app)}</script>
</body></html>
'''
open(sys.argv[1], 'w').write(out)
print(sys.argv[1], len(out.encode()) // 1024, 'KB')
