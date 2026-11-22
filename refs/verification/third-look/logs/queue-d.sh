#!/bin/bash
cd /home/poe/cellestial-studio/refs/verification/third-look/tools
run() { name=$1; shift; "$@" > ../logs/$name.log 2>&1; echo "exit $?" >> ../logs/$name.log; }
run b7 node b7.mjs --only all --sizes desk,phone
run b7-small node b7.mjs --only all --sizes small,short
run stars node stars.mjs
run star-side node star-side.mjs
run logo-side node logo-side.mjs
run phone-turn node phone-turn.mjs
run phone-claim-capricornus node phone-claim.mjs --size phone --fig 4
run phone-claim-aries-360 node phone-claim.mjs --size small --fig 7
run phone-claim-leo-375 node phone-claim.mjs --size short --fig 11
run desk-claim-scorpius node phone-claim.mjs --size desk --fig 2
run f8 node f8.mjs
run misc node misc.mjs
run round node round.mjs
run net node net.mjs
run preload-console node preload-console.mjs
echo done > ../logs/queue-d.done
