#!/bin/bash
cd /home/poe/cellestial-studio/refs/verification/third-look/tools
run() { name=$1; shift; "$@" > ../logs/$name.log 2>&1; echo "exit $?" >> ../logs/$name.log; }
run loader-slow node loader-slow.mjs
run warp-rec-2 node warp-rec.mjs --ways top,picked,far --runs 2
run f8-close node f8-close.mjs
run phone-side node phone-side.mjs
run desk-stations node phone-sky.mjs --size desk --only stations
echo done > ../logs/queue-e.done
