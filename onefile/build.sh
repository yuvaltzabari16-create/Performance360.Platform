#!/usr/bin/env bash
# Builds the one-file edition (onefile/dist/index.html): the app, the database library and the full app's own logic
# (assistant, calendar, payments, meals, progress) in one self-contained page you can drop onto Netlify.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
../node_modules/esbuild/bin/esbuild entry.ts --bundle --format=iife --global-name=P360 --minify --target=es2019 --outfile=dist/logic.js --log-level=warning
python3 - <<'PY'
safe = lambda js: js.replace('</script', '<\\/script').replace('<!--', '<\\!--')
shell = open('shell.html').read()
out = shell.replace('/*__SUPABASE__*/', safe(open('../node_modules/@supabase/supabase-js/dist/umd/supabase.js').read())) \
           .replace('/*__LOGIC__*/', safe(open('dist/logic.js').read())) \
           .replace('/*__APP__*/', safe(open('app.js').read()))
open('dist/index.html', 'w').write(out)
print('dist/index.html', len(out.encode()) // 1024, 'KB')
PY
