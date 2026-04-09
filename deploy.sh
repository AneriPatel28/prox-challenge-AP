#!/bin/bash
# deploy.sh — build and deploy both services to GCP Cloud Run
# Usage: ./deploy.sh
# Prerequisites: gcloud CLI authenticated, PROJECT_ID and REGION set below

set -e

PROJECT_ID="prox-challenge-ap-492720"
REGION="us-central1"                # ← replace if needed
BACKEND_SERVICE="omnipro-backend"
FRONTEND_SERVICE="omnipro-frontend"
REGISTRY="gcr.io/$PROJECT_ID"

echo "=== Building and deploying to project: $PROJECT_ID ==="

# ── 1. Backend ────────────────────────────────────────────────────────────────
echo ""
echo "--- Backend: building image ---"
docker build \
  -f backend/Dockerfile \
  -t $REGISTRY/$BACKEND_SERVICE:latest \
  .

echo "--- Backend: pushing to GCR ---"
docker push $REGISTRY/$BACKEND_SERVICE:latest

echo "--- Backend: deploying to Cloud Run ---"
gcloud run deploy $BACKEND_SERVICE \
  --image $REGISTRY/$BACKEND_SERVICE:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --set-env-vars "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" \
  --project $PROJECT_ID

BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE \
  --platform managed --region $REGION --project $PROJECT_ID \
  --format "value(status.url)")
echo "Backend URL: $BACKEND_URL"

# ── 2. Frontend ───────────────────────────────────────────────────────────────
echo ""
echo "--- Frontend: building image (baking in backend URL) ---"
docker build \
  -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=$BACKEND_URL \
  -t $REGISTRY/$FRONTEND_SERVICE:latest \
  ./frontend

echo "--- Frontend: pushing to GCR ---"
docker push $REGISTRY/$FRONTEND_SERVICE:latest

echo "--- Frontend: deploying to Cloud Run ---"
gcloud run deploy $FRONTEND_SERVICE \
  --image $REGISTRY/$FRONTEND_SERVICE:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --project $PROJECT_ID

FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE \
  --platform managed --region $REGION --project $PROJECT_ID \
  --format "value(status.url)")

# ── 3. Update backend CORS with real frontend URL ─────────────────────────────
echo ""
echo "--- Updating backend CORS with frontend URL ---"
gcloud run services update $BACKEND_SERVICE \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --update-env-vars "FRONTEND_URL=$FRONTEND_URL"

echo ""
echo "=== Done ==="
echo "Frontend: $FRONTEND_URL"
echo "Backend:  $BACKEND_URL"
