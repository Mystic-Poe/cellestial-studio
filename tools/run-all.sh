#!/usr/bin/bash
# Every check suite and every sheet tool, one after another, each with its own log.
#
#   PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm astro dev --port 4500   (in another shell)
#   tools/run-all.sh [log folder]        default: refs/verification/round-2/logs
#   tools/run-all.sh [log folder] checks  only the suites that count checks (no sheets rebuilt)
#
# The dev server must be up on port 4500 (every tool's default) and must have been started WITH the
# Turnstile test key, or the dialogs' spam check fails and the runs are void. The sky needs the real
# GPU, which the tools ask for themselves. The sheet tools rewrite refs/<scene>/compare/.
# status.txt in the log folder has one "exit N (name)" line per tool: every one must be 0.
cd "$(dirname "$0")/.." || exit 1
L=${1:-refs/verification/round-2/logs}
ONLY=${2:-all}
mkdir -p "$L"
: > "$L/status.txt"
run() {
	name=$1
	shift
	echo "=== $name: $*" | tee -a "$L/status.txt"
	"$@" > "$L/$name.log" 2>&1
	echo "exit $? ($name)" | tee -a "$L/status.txt"
}
run loader-measure node tools/loader/measure.mjs --gpu
run loader-measure-phone-4x node tools/loader/measure.mjs --gpu --throttle 4 --size phone
run sky-measure node tools/sky/measure.mjs
run sky-meaning node tools/sky/meaning.mjs
run sky-meaning-all node tools/sky/meaning-all.mjs
run roots-words node tools/roots/words.mjs
run roots-measure node tools/roots/measure.mjs
run transitions-measure node tools/transitions/measure.mjs
run chrome-compare node tools/chrome/compare.mjs
if [ "$ONLY" != checks ]; then
	run sky-compare node tools/sky/compare.mjs
	run roots-compare node tools/roots/compare.mjs --gpu
	run transitions-strip node tools/transitions/strip.mjs
	run loader-compare node tools/loader/compare.mjs --only desk,phone,a5,short
fi
echo "ALL DONE" | tee -a "$L/status.txt"
