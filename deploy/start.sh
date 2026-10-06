#!/bin/sh
# Starts the game server. With a backup configured (LITESTREAM_REPLICA_URL), an empty volume
# (a new machine, a lost disk) first gets the last backup back, then Litestream runs the
# server and keeps copying the database while it changes.
set -e
DB="${DATA_DIR:-/data}/boardgames.sqlite"
SERVER="node packages/server/dist/index.js"

if [ -n "$LITESTREAM_REPLICA_URL" ]; then
  litestream restore -config /etc/litestream.yml -if-db-not-exists -if-replica-exists "$DB"
  exec litestream replicate -config /etc/litestream.yml -exec "$SERVER"
fi

echo "LITESTREAM_REPLICA_URL is not set: the database is not backed up" >&2
exec $SERVER
