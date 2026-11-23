#!/usr/bin/env bash
cd "$(dirname "$0")"
L=../logs
while [ ! -f $L/chain-g.done ]; do sleep 5; done
for s in side side740; do R3_OUT=taps-again node all-taps.mjs --size $s > $L/all-taps-again-$s.log 2>&1; echo "exit $?" >> $L/all-taps-again-$s.log; done
echo done > $L/chain-h.done
