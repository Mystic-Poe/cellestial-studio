#!/bin/bash
cd /home/poe/cellestial-studio/refs/verification/third-look/tools
run() { name=$1; shift; "$@" > ../logs/$name.log 2>&1; echo "exit $?" >> ../logs/$name.log; }
run loader-seen node loader-seen.mjs
run warp-probe node warp-probe.mjs --runs 6
run side-stations node phone-sky.mjs --size side --only stations
run b7-side node b7.mjs --only all --sizes side
run b7-write node b7.mjs --only write --sizes desk,phone
echo done > ../logs/queue-f.done
