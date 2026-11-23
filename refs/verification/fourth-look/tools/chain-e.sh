#!/usr/bin/env bash
# The fourth look, item 1d: the build the third look judged (4618) beside the new one (4619), both served
# with their text gzip-compressed, on slow 4G: nothing pressed, and a skip at the mount, at 1.0 s, at 2.5 s.
cd "$(dirname "$0")"
L=../logs
while [ ! -f $L/chain-c.done ]; do sleep 5; done
m() { tag=$1; shift; node mine-loader.mjs "$@" --tag "$tag" > $L/mine-$tag.log 2>&1; echo "exit $?" >> $L/mine-$tag.log; }
for b in old:4618 new:4619; do
n=${b%%:*}; p=${b##*:}
R3_BASE=http://localhost:$p m gz-$n-slow4g        --line slow4g --runs 3 --strip 500
R3_BASE=http://localhost:$p m gz-$n-slow4g-mount  --line slow4g --case mount --runs 3 --norec
R3_BASE=http://localhost:$p m gz-$n-slow4g-at2500 --line slow4g --case at:2500 --runs 3 --norec
R3_BASE=http://localhost:$p m gz-$n-slow4g-at4500 --line slow4g --case at:4500 --runs 2 --norec
R3_BASE=http://localhost:$p m gz-$n-fast-at1000   --line fast --case at:1000 --runs 3 --norec
R3_BASE=http://localhost:$p m gz-$n-fast-at3000   --line fast --case at:3000 --runs 3 --norec
done
echo done > $L/chain-e.done
