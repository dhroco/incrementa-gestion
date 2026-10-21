#!/usr/bin/env bash
# Crea (o deja al día) el environment «produccion» del repo en GitHub:
#   - exige la aprobación de David antes de cada despliegue a prod;
#   - solo acepta la rama prod;
#   - guarda las variables de Azure de prod (no son secretos), que dentro de este environment
#     pisan a las del repo (que son las de pre-prod).
# Se puede correr más de una vez.
#
#   ./infra/azure/scripts/environment-github-prod.sh
set -euo pipefail

REPO="dhroco/incrementa-gestion"
ENV="produccion"
RG="rg-incrementa-gestion-prod"

TENANT="9127c9cd-62bb-4118-8374-87e9b7fc8acc"
SUSCRIPCION="2fdd7c0a-664d-46ea-863d-73f96627f217"
CLIENT_DEPLOY="$(az identity show -g "$RG" -n id-incrementa-github-deploy-prod --query clientId -o tsv)"

YO="$(gh api user --jq .id)"
echo "1/4 Environment $ENV con tu aprobación obligatoria…"
gh api -X PUT "repos/$REPO/environments/$ENV" --silent --input - <<EOF
{"wait_timer":0,"prevent_self_review":false,
 "reviewers":[{"type":"User","id":$YO}],
 "deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
EOF

echo "2/4 Solo la rama prod…"
YA="$(gh api "repos/$REPO/environments/$ENV/deployment-branch-policies" --jq '[.branch_policies[] | select(.name == "prod")] | length')"
if [ "$YA" = "0" ]; then
  gh api -X POST "repos/$REPO/environments/$ENV/deployment-branch-policies" -f name=prod -f type=branch --silent
fi

echo "3/4 Variables de Azure de prod…"
gh variable set AZURE_TENANT_ID        --env "$ENV" -R "$REPO" --body "$TENANT"
gh variable set AZURE_SUBSCRIPTION_ID  --env "$ENV" -R "$REPO" --body "$SUSCRIPCION"
gh variable set AZURE_CLIENT_ID_DEPLOY --env "$ENV" -R "$REPO" --body "$CLIENT_DEPLOY"

echo "4/4 Comprobación:"
gh api "repos/$REPO/environments/$ENV" \
  --jq '"  Revisores: " + ([.protection_rules[]|select(.type=="required_reviewers")|.reviewers[].reviewer.login]|join(", "))'
gh api "repos/$REPO/environments/$ENV/deployment-branch-policies" \
  --jq '"  Ramas:     " + ([.branch_policies[].name]|join(", "))'
echo "  Variables:"
gh variable list --env "$ENV" -R "$REPO" | sed 's/^/    /'
