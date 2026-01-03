#!/usr/bin/env bash

cd $(dirname $0)

for FILE in $(ls views); do
  NAME=$(echo "${FILE:0:-3}")
  CONTENT=$(cat "views/${FILE}")
  CONTENT=$(echo "${CONTENT:10:-1}")

  TMPFILE=$(mktemp)
  jq --arg CONTENT "${CONTENT}" ".objects[0].views.${NAME}.map = \$CONTENT" "io-package.json" > "${TMPFILE}"
  mv "${TMPFILE}" "io-package.json"
done

exit 0
