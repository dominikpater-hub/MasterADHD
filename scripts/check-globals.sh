#!/usr/bin/env bash
# T-8: strażnik kolizji globali.
# 13 modułów dzieli jeden globalny zasięg leksykalny (klasyczne <script>, bo
# inline onclick wymaga zasięgu globalnego). Duplikat top-level const/let/function
# w dwóch plikach wywala CAŁĄ aplikację przy ładowaniu — po cichu. Ten skrypt
# to łapie w CI, dokładnie tak jak zaleca audyt 2.0.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ Szukam kolizji deklaracji top-level w js/*.js …"
dupes=$(grep -rhnoE '^(async function|function|const|let|var)[[:space:]]+[A-Za-z_$][A-Za-z0-9_$]*' js/*.js \
  | sed -E 's/.*(async function|function|const|let|var)[[:space:]]+//' \
  | sort | uniq -d || true)

if [ -n "$dupes" ]; then
  echo "❌ Kolizja globali — te nazwy zadeklarowano w więcej niż jednym miejscu:"
  echo "$dupes" | sed 's/^/   • /'
  echo "   (duplikat const/let/function w dzielonym zasięgu wywala aplikację po cichu)"
  exit 1
fi
echo "✅ Brak kolizji globali."

echo "▸ node --check każdego modułu + sw.js …"
for f in js/*.js sw.js; do node --check "$f"; done
echo "✅ Składnia OK."
