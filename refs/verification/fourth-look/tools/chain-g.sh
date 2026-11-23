#!/usr/bin/env bash
cd "$(dirname "$0")"
L=../logs
while [ ! -f $L/chain-f.done ]; do sleep 5; done
node f8-all.mjs --sizes desk,phone > $L/f8-all-every.log 2>&1; echo "exit $?" >> $L/f8-all-every.log
echo done > $L/chain-g.done
