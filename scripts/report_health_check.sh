#!/usr/bin/env bash
# Read-only operational checks for the report (container health, endpoint
# reachability, resource usage). Safe to run repeatedly; touches no data.
set -u
cd "$(dirname "$0")/.." || exit 1

echo "════════════════════════════════════════════════════════════════"
echo " 1. Container health (docker compose ps)"
echo "════════════════════════════════════════════════════════════════"
docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null

echo
echo "════════════════════════════════════════════════════════════════"
echo " 2. Service health endpoints (each microservice)"
echo "════════════════════════════════════════════════════════════════"
for entry in "8000:api-gateway" "8001:auth-service" "8002:data-ingestion" \
             "8003:ml-training" "8004:metrics" "8005:dl-training"; do
  port=${entry%%:*}; name=${entry##*:}
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://localhost:$port/health")
  printf "  %-16s (:%s) -> %s\n" "$name" "$port" "$code"
done

echo
echo "════════════════════════════════════════════════════════════════"
echo " 3. Auth boundary via gateway :8000 (401 without token, 200 with)"
echo "════════════════════════════════════════════════════════════════"
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@acme-ml.com","password":"Demo1234!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))")
if [ -n "$TOKEN" ]; then
  printf "  login                -> 200 (token: %s chars)\n" "${#TOKEN}"
else
  printf "  login                -> FAILED (no token)\n"
fi
curl -s -o /dev/null -w "  datasets(no token)   -> %{http_code}\n" http://localhost:8000/datasets
curl -s -o /dev/null -w "  datasets(token)      -> %{http_code}\n" -H "Authorization: Bearer $TOKEN" http://localhost:8000/datasets
curl -s -o /dev/null -w "  pipelines(token)     -> %{http_code}\n" -H "Authorization: Bearer $TOKEN" http://localhost:8000/pipelines
curl -s -o /dev/null -w "  billing/plans        -> %{http_code}\n" http://localhost:8000/billing/plans

echo
echo "════════════════════════════════════════════════════════════════"
echo " 4. Live resource usage (docker stats snapshot)"
echo "════════════════════════════════════════════════════════════════"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" $(docker compose ps -q 2>/dev/null)
