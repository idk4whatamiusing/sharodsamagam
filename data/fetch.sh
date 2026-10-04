#!/bin/bash
url="$1"
path="${url#https://durgapujakolkata.in}"
[ -z "$path" ] && path="/"
file="/Users/x/pujo/data/raw${path}.html"
[ "$path" = "/" ] && file="/Users/x/pujo/data/raw/index.html"
mkdir -p "$(dirname "$file")"
curl -sL --max-time 60 -A "Mozilla/5.0 (Macintosh) scraper-personal" "$url" -o "$file"
echo "$path $(wc -c < "$file")"
