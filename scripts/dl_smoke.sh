#!/usr/bin/env bash
# dl_smoke.sh — end-to-end smoke for the deep-learning service.
#
# What it covers (assumes the docker-compose stack is up):
#   1. dl-training-service is reachable through the gateway
#   2. /dl/gpu reports CUDA visibility (warns if CPU-only)
#   3. /dl/train rejects an obviously oversized request before queuing
#   4. /dl/train accepts the demo-friendly tiny_resnet @ 64px batch=32 cfg
#   5. task_results progress polls until success or failure
#
# This script is meant to be re-run on the user's 1660 Super box. It does
# NOT seed a dataset — that's a separate one-shot — but expects the
# `IMAGE_DATASET_ROOT/<dataset_id>` directory to already contain a real
# ImageFolder layout.
#
# Usage:
#   scripts/dl_smoke.sh <gateway_url> <jwt> <pipeline_id> <dataset_id>

set -euo pipefail

GATEWAY="${1:-http://localhost:8000}"
JWT="${2:-}"
PIPELINE_ID="${3:-}"
DATASET_ID="${4:-}"

if [[ -z "$JWT" || -z "$PIPELINE_ID" || -z "$DATASET_ID" ]]; then
  echo "usage: $0 <gateway_url> <jwt> <pipeline_id> <dataset_id>" >&2
  exit 2
fi

auth_header=(-H "Authorization: Bearer ${JWT}")

# Pretty banner — nothing fancy, just makes the demo log readable.
banner() { printf '\n\033[1;36m── %s ──\033[0m\n' "$*"; }
ok()     { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn()   { printf '\033[1;33m⚠\033[0m %s\n' "$*"; }
fail()   { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

banner "1/5  reach dl-training-service through the gateway"
status="$(curl -fsS -o /dev/null -w '%{http_code}' "${auth_header[@]}" \
  "${GATEWAY}/dl/gpu" || true)"
if [[ "$status" != "200" ]]; then
  fail "/dl/gpu returned ${status} — is dl-training-service running?"
fi
ok "/dl/gpu reachable"

banner "2/5  GPU visibility probe"
gpu="$(curl -fsS "${auth_header[@]}" "${GATEWAY}/dl/gpu")"
echo "$gpu" | sed 's/^/   /'
case "$gpu" in
  *'"available": true'*) ok "CUDA visible to the worker" ;;
  *) warn "no CUDA — training will run on CPU (slow but functional)" ;;
esac

banner "3/5  /dl/train must refuse an obviously oversized request"
oversize_response="$(curl -sS -o /tmp/dl_smoke_oversize.json -w '%{http_code}' \
  "${auth_header[@]}" -H "Content-Type: application/json" \
  -X POST "${GATEWAY}/dl/train" -d "{
    \"pipeline_id\": \"${PIPELINE_ID}\",
    \"dataset_id\":  \"${DATASET_ID}\",
    \"arch\": \"mobilenet_v3_small\",
    \"input_size\": 224,
    \"epochs\": 5,
    \"batch_size\": 64,
    \"lr\": 0.001,
    \"optimizer\": \"adam\",
    \"pretrained\": false,
    \"augment\": false
  }" || true)"
case "$oversize_response" in
  202) warn "the oversize request *was accepted* — your DEFAULT_MAX_VRAM_MB is more generous than the smoke expects" ;;
  400|409|413)
    detail="$(jq -r '.detail // .error' /tmp/dl_smoke_oversize.json 2>/dev/null || cat /tmp/dl_smoke_oversize.json)"
    ok "refused with ${oversize_response}: ${detail}"
    ;;
  *) fail "unexpected status ${oversize_response} on the oversize probe" ;;
esac

banner "4/5  /dl/train demo-friendly run"
start_response="$(curl -sS "${auth_header[@]}" -H "Content-Type: application/json" \
  -X POST "${GATEWAY}/dl/train" -d "{
    \"pipeline_id\": \"${PIPELINE_ID}\",
    \"dataset_id\":  \"${DATASET_ID}\",
    \"arch\": \"tiny_resnet\",
    \"input_size\": 64,
    \"epochs\": 2,
    \"batch_size\": 32,
    \"lr\": 0.001,
    \"optimizer\": \"adam\",
    \"pretrained\": false,
    \"augment\": false
  }")"
echo "$start_response" | sed 's/^/   /'
task_id="$(echo "$start_response" | jq -r '.task_id // empty')"
version_id="$(echo "$start_response" | jq -r '.version_id // empty')"
[[ -n "$task_id" && -n "$version_id" ]] || fail "missing task_id / version_id in response"
ok "queued task=${task_id} version=${version_id}"

banner "5/5  poll task_results until terminal state"
deadline=$(( $(date +%s) + 1200 ))   # 20-minute hard ceiling
last_pct=-1
while (( $(date +%s) < deadline )); do
  body="$(curl -fsS "${auth_header[@]}" "${GATEWAY}/dl/train/${task_id}")"
  status="$(echo "$body" | jq -r '.status')"
  pct="$(echo "$body" | jq -r '.progress_pct // 0')"
  stage="$(echo "$body" | jq -r '.stage // "?"')"
  if [[ "$pct" != "$last_pct" ]]; then
    printf '   %s  %3s%%  %s\n' "$status" "$pct" "$stage"
    last_pct="$pct"
  fi
  case "$status" in
    success)
      acc="$(echo "$body" | jq -r '.metrics.val_acc // "?"')"
      ok "training succeeded · val_acc=${acc}"
      exit 0
      ;;
    failure)
      err="$(echo "$body" | jq -r '.error_message // "<no message>"')"
      fail "training failed: ${err}"
      ;;
  esac
  sleep 3
done
fail "training did not reach a terminal state within 20 minutes"
