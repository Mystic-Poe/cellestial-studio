#!/usr/bin/env bash
# The fourth look, part 2: the sky at the owner's two sizes, the build at 8724ef5 (4616) beside this one
# (4615), pixel for pixel: twelve stations, the empty sky, a seeded one, and every star lit (the meanings).
cd "$(dirname "$0")"
L=../logs
while [ ! -f $L/chain-h.done ]; do sleep 5; done
for s in desk phone; do
R3_BASE=http://localhost:4616 node sky-same.mjs before --size $s --all > $L/sky-same-before-$s.log 2>&1; echo "exit $?" >> $L/sky-same-before-$s.log
R3_BASE=http://localhost:4616 node sky-same.mjs again --size $s --all > $L/sky-same-control-$s.log 2>&1; echo "exit $?" >> $L/sky-same-control-$s.log
node sky-same.mjs after --size $s --all > $L/sky-same-after-$s.log 2>&1; echo "exit $?" >> $L/sky-same-after-$s.log
done
echo done > $L/chain-i.done
