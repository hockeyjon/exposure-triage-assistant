#!/bin/bash
# Restarts the backend if it's not running. Catches the process being
# killed by a shared-host resource-limit enforcement action (CloudLinux
# LVE hitting the account's I/O/CPU/memory quota), not just a server
# reboot — a crontab @reboot entry alone doesn't cover that case, since
# the box never actually restarts.
#
# Install with `crontab -e`, running every few minutes:
#   */5 * * * * /home/kibam7p6sju0/vulnerabilityscanner-backend/scripts/watchdog.sh >> /home/kibam7p6sju0/vulnerabilityscanner-backend/logs/watchdog.log 2>&1
#
# Deliberately not aggressive: checks every few minutes, not every few
# seconds, and only acts when the process is actually down — it won't
# restart-spam a healthy-but-slow process, which would just burn more of
# the same I/O budget that caused the problem in the first place.

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

STATUS=$(.venv/bin/supervisorctl -c supervisord.conf status vulnerabilityscanner-backend 2>&1)

if echo "${STATUS}" | grep -q RUNNING; then
  exit 0
fi

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) not running (${STATUS}), restarting"

if echo "${STATUS}" | grep -qi "refused connection\|no such file\|ECONNREFUSED"; then
  # supervisord itself isn't up — starting it also autostarts the program
  .venv/bin/supervisord -c supervisord.conf
else
  # supervisord is up but the program isn't — just restart the program
  .venv/bin/supervisorctl -c supervisord.conf start vulnerabilityscanner-backend
fi
