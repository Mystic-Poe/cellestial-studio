#!/usr/bin/env bash
# The fourth look, part 2: the builders' suites and sheets on the dev server (4500), then the sheet tools a
# second time on the same build (the control), each set copied to fourth-look/builders-tools/, and the
# builders' folders restored.
cd "$(dirname "$0")/../../../.." || exit 1
F=refs/verification/fourth-look
L=$F/logs
while [ ! -f $L/chain-d.done ]; do sleep 5; done
(PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA setsid nohup pnpm astro dev --port 4500 > $L/dev-4500.log 2>&1 &)
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:4500/ && break; sleep 1; done
sleep 5
tools/run-all.sh $L/suites-2 > $L/run-all-2.out 2>&1
keep() { for s in loading sky roots transitions chrome; do mkdir -p $F/builders-tools/$1/$s; cp -r refs/$s/compare/. $F/builders-tools/$1/$s/; cp refs/$s/*.txt $F/builders-tools/$1/$s/ 2>/dev/null; done; }
keep run-a
git status --short refs/loading refs/sky refs/roots refs/transitions refs/chrome > $L/suites-2/rewritten-a.txt
run() { name=$1; shift; "$@" > $L/suites-2/control-$name.log 2>&1; echo "exit $? (control $name)" >> $L/suites-2/control-status.txt; }
: > $L/suites-2/control-status.txt
run chrome-compare node tools/chrome/compare.mjs
run sky-compare node tools/sky/compare.mjs
run roots-compare node tools/roots/compare.mjs --gpu
run transitions-strip node tools/transitions/strip.mjs
run loader-compare node tools/loader/compare.mjs --only desk,phone,a5,short
run sky-meaning node tools/sky/meaning.mjs
run sky-meaning-all node tools/sky/meaning-all.mjs
keep run-b
git checkout -- refs/loading refs/sky refs/roots refs/transitions refs/chrome
git status --short > $L/suites-2/status-after-restore.txt
fuser -k 4500/tcp > /dev/null 2>&1
echo done > $L/chain-f.done
