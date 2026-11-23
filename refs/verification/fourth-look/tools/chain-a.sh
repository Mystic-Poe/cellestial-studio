#!/usr/bin/env bash
# The fourth look: the loader's clock and first seconds from the recording, production build on 4615.
cd "$(dirname "$0")"
L=../logs
node mine-loader.mjs --line slow4g --runs 5 --strip 500 --tag slow4g-nothing > $L/mine-slow4g-nothing.log 2>&1; echo "exit $?" >> $L/mine-slow4g-nothing.log
node mine-loader.mjs --line 1mbit --runs 3 --strip 1000 --tag 1mbit-nothing > $L/mine-1mbit-nothing.log 2>&1; echo "exit $?" >> $L/mine-1mbit-nothing.log
node mine-loader.mjs --line fast --runs 5 --strip 500 --tag fast-nothing > $L/mine-fast-nothing.log 2>&1; echo "exit $?" >> $L/mine-fast-nothing.log
node mine-loader.mjs --line fast --cpu 4 --runs 5 --tag fast-cpu4-nothing > $L/mine-fast-cpu4-nothing.log 2>&1; echo "exit $?" >> $L/mine-fast-cpu4-nothing.log
node mine-loader.mjs --line slow4g --cpu 4 --runs 5 --tag slow4g-cpu4-nothing > $L/mine-slow4g-cpu4-nothing.log 2>&1; echo "exit $?" >> $L/mine-slow4g-cpu4-nothing.log
echo done > $L/chain-a.done
