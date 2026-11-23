#!/usr/bin/bash
# Round 3, the close-out: the round-3 copies of the third look's scripts for what this round changed, on
# the PRODUCTION build, one after another (they are timing-sensitive: nothing else on the GPU), a log each.
#
#   PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm build
#   pnpm astro preview --port 4615        (in another shell)
#   refs/verification/round-3/tools/close-out.sh [part]     part: sky | loader | measure | all (default)
#
# Everything is written under refs/verification/round-3/piece-4/ (R3_OUT): the scripts' own output in the
# folders they name (phone-sky/, desk-sky/, b7/, loader/, a5/), the logs in logs/, and logs/status.txt with
# one "exit N (name)" line per run. The earlier pieces' evidence in round-3/ is not written over.
# A non-zero exit is not by itself a fault: phone-sky.mjs prints the UPRIGHT phone's rules as FAIL on a
# phone on its side and on a short phone (fixes.txt, "ROUND 3", piece 1, says which and why).
cd "$(dirname "$0")/../../../.." || exit 1
T=refs/verification/round-3/tools
export R3_OUT=piece-4
L=refs/verification/round-3/piece-4/logs
PART=${1:-all}
mkdir -p "$L"
[ "$PART" = all ] && : > "$L/status.txt"
run() {
	name=$1
	shift
	echo "=== $name: $*" | tee -a "$L/status.txt"
	"$@" > "$L/$name.log" 2>&1
	echo "exit $? ($name)" | tee -a "$L/status.txt"
}
if [ "$PART" = all ] || [ "$PART" = sky ]; then
	run all-taps-desk node $T/all-taps.mjs --size desk
	run all-taps-phone node $T/all-taps.mjs --size phone
	run all-taps-side node $T/all-taps.mjs --size side
	run phone-sky-phone node $T/phone-sky.mjs --size phone
	run phone-sky-small node $T/phone-sky.mjs --size small
	run phone-sky-short node $T/phone-sky.mjs --size short
	run phone-sky-side node $T/phone-sky.mjs --size side
	run short-scope node $T/short-scope.mjs
	run b7 node $T/b7.mjs
	run b7-small-short-side node $T/b7.mjs --only all --sizes small,short,side
	run f8 node $T/f8.mjs
fi
if [ "$PART" = all ] || [ "$PART" = loader ]; then
	run clock-all node $T/clock-all.mjs
	run loader-seen node $T/loader-seen.mjs
	run loader-slow node $T/loader-slow.mjs
	run a5-probe node $T/a5-probe.mjs --runs 20
	run a5-probe-cpu4x node $T/a5-probe.mjs --runs 12 --throttle 4
	run a5-probe-return node $T/a5-probe-return.mjs
	run a5-probe-return-slow4g node $T/a5-probe-return.mjs 4 slow4g
	run preload-console node $T/preload-console.mjs
fi
if [ "$PART" = all ] || [ "$PART" = measure ]; then
	M="node tools/loader/measure.mjs --gpu --size phone --url http://localhost:4615 --only full,short,skip,key,quiet-keys,broken,resize,no-storage"
	run measure-prod-phone $M
	run measure-prod-phone-cpu4x $M --throttle 4
	run measure-prod-phone-slow4g $M --net slow4g
	run measure-prod-phone-cpu4x-slow4g $M --throttle 4 --net slow4g
fi
echo "DONE ($PART)" | tee -a "$L/status.txt"
