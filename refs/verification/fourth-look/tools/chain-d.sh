#!/usr/bin/env bash
# The fourth look: items 1e, 1f, 1g and part 2's production runs, after the loader chains.
cd "$(dirname "$0")"
L=../logs
while [ ! -f $L/chain-e.done ]; do sleep 5; done
r() { name=$1; shift; "$@" > $L/$name.log 2>&1; echo "exit $?" >> $L/$name.log; }
r mine-fast-check node mine-loader.mjs --line fast --runs 2 --tag fast-check
r f8-all node f8-all.mjs --sizes desk,phone,side932
r f8 node f8.mjs
r f8-close node f8-close.mjs
r pairs-desk node pairs.mjs --sizes desk,phone --tag pairs-desk
r all-taps-desk node all-taps.mjs --size desk --shots 9
r preload-console node preload-console.mjs
r a5-probe node a5-probe.mjs --runs 12
r a5-probe-return node a5-probe-return.mjs 6
r a5-probe-return-slow node a5-probe-return.mjs 4 slow4g
r fall-cut node fall-cut.mjs
r phone-sky node phone-sky.mjs --size phone
r nojs-same node nojs-same.mjs
r rm-words-small node rm-words.mjs --sizes small --tag small
M=../../../../tools/loader/measure.mjs
O=full,short,skip,key,quiet-keys,broken,resize,no-storage
for size in desk phone; do
r measure-$size-fast node $M --url http://localhost:4615 --gpu --size $size --only $O
r measure-$size-cpu4 node $M --url http://localhost:4615 --gpu --size $size --throttle 4 --only $O
r measure-$size-slow4g node $M --url http://localhost:4615 --gpu --size $size --net slow4g --only $O
r measure-$size-both node $M --url http://localhost:4615 --gpu --size $size --throttle 4 --net slow4g --only $O
done
r visit node visit.mjs
echo done > $L/chain-d.done
