#!/bin/bash
# The timing-sensitive runs, one after another, nothing else on the GPU.
cd /home/poe/cellestial-studio/refs/verification/third-look/tools
run() { name=$1; shift; "$@" > ../logs/$name.log 2>&1; echo "exit $?" >> ../logs/$name.log; }
run flash node flash.mjs
run flash-level node flash-level.mjs
run flash-dip node flash-dip.mjs --runs 3 --sizes desk
run flash-dip-cpu4x node flash-dip.mjs --runs 3 --sizes desk --throttle 4 --tag cpu4x
run flash-dip-phone node flash-dip.mjs --runs 3 --sizes phone --tag phone
run flash-dip-phone-cpu4x node flash-dip.mjs --runs 3 --sizes phone --throttle 4 --tag phone-cpu4x
run flash-dip-from-roots node flash-dip.mjs --runs 2 --sizes desk,phone --from roots --dest build,claim,contact,sky --tag from-roots
run flash-dip-from-roots-cpu4x node flash-dip.mjs --runs 2 --sizes desk,phone --from roots --dest build,claim,contact,sky --throttle 4 --tag from-roots-cpu4x
run flash-dip-to-sky-cpu4x node flash-dip.mjs --runs 2 --sizes desk,phone --from sky --dest sky --throttle 4 --tag to-sky-cpu4x
run clock-all node clock-all.mjs
run clock-slow node clock-slow.mjs
run clock-nav node clock-nav.mjs
cd /home/poe/cellestial-studio
M="node tools/loader/measure.mjs --url http://localhost:4615 --gpu --only full,short,skip,key,quiet-keys,broken,resize,no-storage"
T=refs/verification/third-look/logs
$M --size phone > $T/loader-measure-phone.log 2>&1; echo "exit $?" >> $T/loader-measure-phone.log
$M --size phone --throttle 4 > $T/loader-measure-phone-cpu4x.log 2>&1; echo "exit $?" >> $T/loader-measure-phone-cpu4x.log
$M --size phone --net slow4g > $T/loader-measure-phone-slow4g.log 2>&1; echo "exit $?" >> $T/loader-measure-phone-slow4g.log
$M --size phone --throttle 4 --net slow4g > $T/loader-measure-phone-cpu4x-slow4g.log 2>&1; echo "exit $?" >> $T/loader-measure-phone-cpu4x-slow4g.log
$M --size desk > $T/loader-measure-desk.log 2>&1; echo "exit $?" >> $T/loader-measure-desk.log
$M --size desk --net slow4g > $T/loader-measure-desk-slow4g.log 2>&1; echo "exit $?" >> $T/loader-measure-desk-slow4g.log
cd /home/poe/cellestial-studio/refs/verification/third-look/tools
run warp-rec node warp-rec.mjs
run loader-stall node loader-stall.mjs
run visit node visit.mjs
run flight-slow node flight-slow.mjs
run light node light.mjs
run turnstile node turnstile.mjs
echo done > ../logs/queue-c.done
