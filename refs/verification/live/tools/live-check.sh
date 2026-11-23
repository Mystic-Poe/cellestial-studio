#!/usr/bin/bash
# After publishing: what the live site serves, checked without sending anything.
# Usage: live-check.sh <out dir>     (reads the clean build in ../clean-clone/dist for comparison)
set -u
B=https://cellestialstudio.com
S=/tmp/claude-1000/-home-poe-Work/997ecee9-30a3-4fc9-8f3c-6efca36572a4/scratchpad
CLEAN=$S/clean-clone/dist
OUT=${1:-$S/live/run}
mkdir -p "$OUT"
cd "$OUT" || exit 1
UA="site-check"

echo "== pages"
for p in / /contact /contact/ /start /start/ /start/new /start/new/ /admin/ /admin/config.yml /credits.txt /favicon.ico /favicon.png /nope-404; do
	printf '%s  %s\n' "$(curl -s -A "$UA" -o /dev/null -w '%{http_code}' "$B$p")" "$p"
done

echo "== the homepage against the clean build of the same commit"
curl -s -A "$UA" -o index.html "$B/"
norm() { sed -E 's/Base\.[A-Za-z0-9_-]+\.css/Base.X.css/g; s/data-sitekey="[^"]*"/data-sitekey="K"/g; s/(0x|1x|2x|3x)[0-9A-Za-z_-]{18,}/KEY/g' "$1"; }
if diff <(norm index.html) <(norm "$CLEAN/index.html") > index.diff; then echo "same, but for the stylesheet's name and the spam-check key"; else echo "DIFFERS: $(wc -l < index.diff) lines (index.diff)"; head -6 index.diff | cut -c1-200; fi
for page in contact start start/new admin; do
	curl -s -A "$UA" -o "page-$(echo $page | tr / -).html" "$B/$page/"
	if diff <(norm "page-$(echo $page | tr / -).html") <(norm "$CLEAN/$page/index.html") > /dev/null; then echo "same: /$page/"; else echo "DIFFERS: /$page/ ($(diff <(norm "page-$(echo $page | tr / -).html") <(norm "$CLEAN/$page/index.html") | wc -l) lines)"; fi
done

echo "== the spam-check key in the live pages (must not be the test key)"
grep -ohE '(0x|1x|2x|3x)[0-9A-Za-z_-]{18,}' index.html page-contact.html | sort | uniq -c | sed -E 's/((0x|1x|2x|3x)[0-9A-Za-z_-]{4})[0-9A-Za-z_-]+/\1…/'
grep -c '1x00000000000000000000AA' index.html page-contact.html

echo "== every file of the build is served, byte for byte (pages and the stylesheet apart)"
ok=0; bad=0
while IFS= read -r f; do
	rel=${f#"$CLEAN"/}
	case "$rel" in *.html|_astro/Base.*.css) continue ;; esac
	want=$(sha256sum "$f" | cut -d' ' -f1)
	got=$(curl -s -A "$UA" "$B/$rel" | sha256sum | cut -d' ' -f1)
	if [ "$want" = "$got" ]; then ok=$((ok + 1)); else bad=$((bad + 1)); echo "  DIFFERS or missing: /$rel ($(curl -s -A "$UA" -o /dev/null -w '%{http_code}' "$B/$rel"))"; fi
done < <(find "$CLEAN" -type f | sort)
echo "  $ok the same, $bad not"
css=$(grep -oE '/_astro/Base\.[A-Za-z0-9_-]+\.css' index.html | head -1)
echo "  stylesheet $css -> $(curl -s -A "$UA" -o live.css -w '%{http_code} %{size_download} bytes' "$B$css") (clean build: $(wc -c < "$CLEAN"/_astro/Base.*.css) bytes; $(cmp -s live.css "$CLEAN"/_astro/Base.*.css && echo identical || echo not identical))"

echo "== the three Workers answer on their routes (nothing is sent)"
printf 'contact, GET:            %s\n' "$(curl -s -A "$UA" -H 'accept: application/json' -w ' [%{http_code}]' "$B/api/contact")"
printf 'contact, POST, no token: %s\n' "$(curl -s -A "$UA" -H 'accept: application/json' -w ' [%{http_code}]' --form-string 'name=Site check' --form-string 'email=check@example.com' --form-string 'message=Automated check after a deploy. No spam-check token, so nothing is sent.' "$B/api/contact")"
printf 'auth, GET:               %s\n' "$(curl -s -A "$UA" -o /dev/null -w '%{http_code} -> %{redirect_url}' "$B/api/auth" | sed -E 's/(client_id=[A-Za-z0-9]{6})[A-Za-z0-9]+/\1…/; s/state=[^&]+/state=…/' | cut -c1-150)"
printf 'onboard, GET ping:       %s\n' "$(curl -s -A "$UA" -w ' [%{http_code}]' "$B/api/onboard/ping")"
