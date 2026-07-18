#!/bin/bash
set -e

BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${BACKEND_ROOT}/scripts/deploy.env"

if [ ! -f "${ENV_FILE}" ]; then
  echo "Missing ${ENV_FILE}."
  echo "Copy scripts/deploy.env.example to scripts/deploy.env and fill in your real deploy target."
  exit 1
fi

# shellcheck source=/dev/null
source "${ENV_FILE}"

ARCHIVE="vulnerabilityscanner-backend.tar.gz"

# In production the backend is deployed to its own directory, unrelated to
# wherever the frontend lands — unlike local dev, where inventory.py finds
# the frontend's package.json via the sibling ../frontend directory. And
# the frontend's own deploy artifact is just its static build output;
# package.json/package-lock.json never ship there by design. So bundle a
# copy into the backend's own archive instead, cleaned up whether this
# script succeeds or fails so it never lingers in the local checkout.
FRONTEND_ROOT="$(cd "${BACKEND_ROOT}/../frontend" && pwd)"
MANIFEST_DIR="${BACKEND_ROOT}/frontend-manifest"
mkdir -p "${MANIFEST_DIR}"
cp "${FRONTEND_ROOT}/package.json" "${FRONTEND_ROOT}/package-lock.json" "${MANIFEST_DIR}/"
trap 'rm -rf "${MANIFEST_DIR}"' EXIT

# Bundle the app, excluding anything that's regeneratable on the server
# (.venv, __pycache__, data/ — the SQLite inventory is rebuilt fresh at
# startup from requirements.txt/package.json), unique to this machine's
# local setup (.env, logs/, supervisor's runtime files), or local-only
# deploy tooling the server has no use for (this script, deploy.env and
# its example). scripts/watchdog.sh is deliberately NOT excluded — it has
# to actually be on the server to be cron'd there. Never ship .env — that
# would overwrite the server's real production secrets with local ones.
echo "Creating archive..."
# Suppress macOS's AppleDouble ._* sidecar files in the archive.
export COPYFILE_DISABLE=1
tar -czf "${BACKEND_ROOT}/${ARCHIVE}" \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.pytest_cache' \
  --exclude='.env' \
  --exclude='data' \
  --exclude='logs' \
  --exclude='supervisord.pid' \
  --exclude='supervisor.sock' \
  --exclude='tests' \
  --exclude='deploy.sh' \
  --exclude='deploy.env' \
  --exclude='deploy.env.example' \
  --exclude='*.tar' \
  --exclude='*.tar.gz' \
  -C "${BACKEND_ROOT}" .

# Deploy
echo "Uploading to ${REMOTE_HOST}:${REMOTE_PATH}..."
scp -i "${SSH_KEY}" "${BACKEND_ROOT}/${ARCHIVE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/${ARCHIVE}"

echo
echo "Uploaded ${ARCHIVE}. On the server:"
echo "  mkdir -p ${REMOTE_PATH} && cd ${REMOTE_PATH} && tar xzf ${ARCHIVE}"
echo "  python3 -m venv --copies .venv # first deploy only — plain 'venv' fails under CageFS (common on shared hosting)"
echo "  # if that then fails on ensurepip, see gbs-fastapi's README Deployment section for the --without-pip + get-pip.py fallback"
echo "  .venv/bin/pip install -r requirements.txt   # includes supervisor"
echo "  cp .env.example .env           # first deploy only — then fill in real values,"
echo "                                  # including FRONTEND_DIR=./frontend-manifest"
echo "  mkdir -p logs                  # first deploy only"
echo "  .venv/bin/supervisorctl -c supervisord.conf restart vulnerabilityscanner-backend   # or supervisord -c supervisord.conf if not already running"
echo
echo "First deploy only — the watchdog now ships in this same archive (scripts/watchdog.sh)."
echo "It restarts the backend if a shared-host resource-limit kill takes it down, which a"
echo "reboot-only crontab entry doesn't cover. On the server:"
echo "  chmod +x scripts/watchdog.sh"
echo "  crontab -e   # add this line as-is, with no leading # — that's a comment in crontab"
echo "  #   and would silently disable the job:"
echo "  */5 * * * * ${REMOTE_PATH}/scripts/watchdog.sh >> ${REMOTE_PATH}/logs/watchdog.log 2>&1"
