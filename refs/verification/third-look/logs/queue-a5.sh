#!/bin/bash
cd /home/poe/cellestial-studio/refs/verification/third-look/tools
run() { name=$1; shift; "$@" > ../logs/$name.log 2>&1; echo "exit $?" >> ../logs/$name.log; }
run a5-probe node a5-probe.mjs --runs 20
run a5-probe-cpu4x node a5-probe.mjs --runs 12 --throttle 4
run a5-probe-return node a5-probe-return.mjs 12
run a5-repeat node a5-repeat.mjs --runs 10
run a5 node a5.mjs
run a5-cpu4x node a5.mjs --throttle 4
echo done > ../logs/queue-a5.done
