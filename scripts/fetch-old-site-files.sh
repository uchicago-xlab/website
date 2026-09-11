#!/usr/bin/env bash
# One-time migration: copy every PDF that the site still links to on the old
# xrisk.uchicago.edu site into files/, at the same path it had there, so the
# existing links keep working after the domain is repointed.
#
# Run from the repo root while the old site is still online:
#   bash scripts/fetch-old-site-files.sh
# Then commit the files/ folder.
set -euo pipefail
cd "$(dirname "$0")/.."

missing=0
grep -ohE 'https://xrisk\.uchicago\.edu/files/[^"]+\.pdf' *.html | sort -u | while read -r url; do
  path="${url#https://xrisk.uchicago.edu/}"
  if [ -s "$path" ]; then echo "have    $path"; continue; fi
  mkdir -p "$(dirname "$path")"
  if curl -fsSL --retry 3 -o "$path" "$url"; then
    echo "fetched $path"
  else
    echo "FAILED  $url" >&2; rm -f "$path"; missing=1
  fi
done

echo
echo "Not a PDF, needs a new home on the new site:"
grep -ohE 'https://xrisk\.uchicago\.edu/[^"]+' *.html | grep -v '\.pdf$' | sort -u
