#!/bin/bash
cd /home/poe/cellestial-studio/refs/verification/third-look/tools
run() { name=$1; shift; "$@" > ../logs/$name.log 2>&1; echo "exit $?" >> ../logs/$name.log; }
run phone-sky-390 node phone-sky.mjs --size phone
run phone-sky-360 node phone-sky.mjs --size small
run phone-sky-375 node phone-sky.mjs --size short
run phone-figures node phone-figures.mjs
echo done > ../logs/queue-phone.done
