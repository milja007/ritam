#!/usr/bin/env bash
# Lokalna provjera Supabase migracija bez Dockera (korak 17).
# Digne privremeni Postgres (initdb), doda stub Supabase `auth` sheme i uloga,
# primijeni sve `supabase/migrations/*.sql` redom i pokrene `supabase/tests/schema.sql`.
# S Dockerom je pravi put `npx supabase start && npx supabase db reset`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [[ -z "${PG_BIN}" || ! -x "${PG_BIN}/initdb" ]]; then
  echo "Nije pronađen Postgres (initdb). Postavi PG_BIN=/putanja/do/postgresql/bin." >&2
  exit 1
fi

WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
RUN_AS=()
if [[ "$(id -u)" == "0" ]]; then
  # Postgres ne radi kao root.
  id -u postgres >/dev/null 2>&1 || useradd -r -M postgres
  chown -R postgres "${WORK}"
  RUN_AS=(runuser -u postgres --)
fi

cleanup() {
  "${RUN_AS[@]}" "${PG_BIN}/pg_ctl" -D "${WORK}/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "${WORK}"
}
trap cleanup EXIT

"${RUN_AS[@]}" "${PG_BIN}/initdb" -D "${WORK}/data" -U postgres -A trust -E UTF8 --no-locale >/dev/null
"${RUN_AS[@]}" "${PG_BIN}/pg_ctl" -D "${WORK}/data" -l "${WORK}/pg.log" -w \
  -o "-p ${PORT} -k ${WORK} -c listen_addresses=''" start >/dev/null

PSQL=("${PG_BIN}/psql" -h "${WORK}" -p "${PORT}" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -f "${ROOT}/supabase/tests/auth-stub.sql"
for migration in "${ROOT}"/supabase/migrations/*.sql; do
  echo "→ $(basename "${migration}")"
  "${PSQL[@]}" -1 -f "${migration}"
done
"${PSQL[@]}" -f "${ROOT}/supabase/tests/schema.sql"
