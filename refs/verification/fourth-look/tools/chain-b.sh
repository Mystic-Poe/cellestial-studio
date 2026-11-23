#!/usr/bin/env bash
# The fourth look, item 1c: a skip before the loader is live, on slow 4G; then the old build beside the new one.
cd "$(dirname "$0")"
L=../logs
while [ ! -f $L/chain-a.done ]; do sleep 5; done
m() { tag=$1; shift; node mine-loader.mjs "$@" --tag "$tag" > $L/mine-$tag.log 2>&1; echo "exit $?" >> $L/mine-$tag.log; }
m skip-mount        --line slow4g --case mount --runs 3 --probe
m skip-at1000       --line slow4g --case at:1000 --runs 4 --probe --strip 250
m skip-at1400       --line slow4g --case at:1400 --runs 3 --probe
m skip-seen300      --line slow4g --case seen:300 --runs 3 --probe
m skip-held-seen300 --line slow4g --hold 1500 --case seen:300 --runs 4 --probe --strip 250
m skip-held-mount   --line slow4g --hold 1500 --case mount --runs 3 --probe
m quiet1000         --line slow4g --case quiet:1000 --runs 2
m link              --line slow4g --case link --runs 2
m linkkey           --line slow4g --case linkkey --runs 2
m skip-then-reload  --line slow4g --case at:1000+reload --runs 2 --norec
m return            --line fast --case return --runs 2 --norec
m return-slow       --line slow4g --case return --runs 1 --norec
echo done > $L/chain-b.done
# the build the third look judged (4616) beside the new one served the same way (4617): neither compressed
R3_BASE=http://localhost:4616 m old-slow4g       --line slow4g --runs 3 --strip 500
R3_BASE=http://localhost:4617 m newstatic-slow4g --line slow4g --runs 3 --strip 500
R3_BASE=http://localhost:4616 m old-slow4g-mount --line slow4g --case mount --runs 3 --norec
R3_BASE=http://localhost:4617 m newstatic-slow4g-mount --line slow4g --case mount --runs 3 --norec
R3_BASE=http://localhost:4616 m old-fast         --line fast --runs 3 --norec
R3_BASE=http://localhost:4617 m newstatic-fast   --line fast --runs 3 --norec
R3_BASE=http://localhost:4616 m old-fast-mount   --line fast --case mount --runs 3 --norec
R3_BASE=http://localhost:4617 m newstatic-fast-mount --line fast --case mount --runs 3 --norec
# one of the loader's four pictures never arrives, or is answered 404
m block-never       --line fast --block c-lit.webp:never --runs 1 --wait 30000 --strip 3000
m block-404         --line fast --block c-lit.webp:404 --runs 1 --wait 30000 --strip 1000
m block-never-press --line fast --block c-lit.webp:never --case at:6000 --runs 1 --wait 30000 --norec
R3_BASE=http://localhost:4616 m old-block-never --line fast --block c-lit.webp:never --runs 1 --wait 30000 --strip 3000
R3_BASE=http://localhost:4616 m old-block-404   --line fast --block c-lit.webp:404 --runs 1 --wait 30000 --strip 1000
R3_BASE=http://localhost:4616 m old-block-never-press --line fast --block c-lit.webp:never --case at:6000 --runs 1 --wait 30000 --norec
m block-wordmark-never --line fast --block wordmark.webp:never --runs 1 --sizes desk --wait 30000 --norec
m block-unlit-never --line fast --block c-unlit.webp:never --runs 1 --sizes desk --wait 30000 --norec
echo done > $L/chain-c.done
