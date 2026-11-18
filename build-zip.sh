#!/bin/sh
# Crea dist/underpressure.zip con la cartella underpressure/ pronta da caricare su Tophost.
set -e
cd "$(dirname "$0")"
mkdir -p dist
rm -f dist/underpressure.zip
zip -rq dist/underpressure.zip underpressure -x 'underpressure/api/config.php' '*.DS_Store'
echo "Creato dist/underpressure.zip"
