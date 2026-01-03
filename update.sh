#!/usr/bin/env bash

cd $(dirname $0)

for FILE in $(ls views); do
  NAME=$(echo "${FILE:0:-3}")
  CONTENT=$(cat "views/${FILE}" | tr "\r" " " | tr "\n" " " | sed -r 's/\s\s+/ /g')
  CONTENT=$(echo "${CONTENT:10:-2}" | sed -r 's/function \(doc/function(doc/g')

  TMPFILE=$(mktemp)
  jq --arg CONTENT "${CONTENT}" ".objects[0].views.${NAME}.map = \$CONTENT" "io-package.json" > "${TMPFILE}"
  mv "${TMPFILE}" "io-package.json"
done

exit 0
