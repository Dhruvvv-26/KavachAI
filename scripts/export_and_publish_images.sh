#!/bin/bash

# ==============================================================================
# KavachAI Docker Image Builder & Publisher
# Use this script to build, package, or push Docker images for direct deployment.
# ==============================================================================

set -e

# Default values
ACTION="build"
DOCKER_USERNAME=""
SERVICES=("worker_service" "policy_service" "trigger_engine" "claims_service" "payment_service" "ml_service" "admin-dashboard")
IMAGE_PREFIX="kavachai"

print_usage() {
    echo "Usage: ./export_and_publish_images.sh [action] [options]"
    echo ""
    echo "Actions:"
    echo "  build   : Just build all the images locally via docker-compose"
    echo "  export  : Build and save the images as a single .tar archive for SCP/direct transfer"
    echo "  publish : Build, tag, and push the images to your Docker Hub registry"
    echo ""
    echo "Options for publish action:"
    echo "  -u <username>  : Your Docker Hub username (Required for publish)"
    echo ""
    echo "Examples:"
    echo "  ./export_and_publish_images.sh export"
    echo "  ./export_and_publish_images.sh publish -u mydockerhubuser"
}

if [ $# -eq 0 ]; then
    print_usage
    exit 1
fi

ACTION=$1
shift

while getopts ":u:" opt; do
  case $opt in
    u) DOCKER_USERNAME="$OPTARG"
    ;;
    \?) echo "Invalid option -$OPTARG" >&2
    exit 1
    ;;
  esac
done

echo "⚙️ Building all services from docker-compose.yml..."
docker compose -f docker-compose.yml build

if [ "$ACTION" == "export" ]; then
    echo "📦 Exporting images to kavachai_images.tar..."
    
    # Get the image names built by compose based on folder rules or explicit image names
    # By default, docker compose names images <project_name>_<service_name>
    # Given the folder is likely 'KavachAI' or 'Desktop', we'll rely on explicit tagging to be safe.
    
    # Let's properly tag them first to ensure predictable export
    for SERVICE in "${SERVICES[@]}"; do
         # Assuming the docker compose container images are built, re-tag them locally
         SRC_IMAGE=$(docker compose config | grep -A 2 "${SERVICE}:" | grep image | awk '{print $2}' | head -1)
         if [ -z "$SRC_IMAGE" ]; then
             SRC_IMAGE="${IMAGE_PREFIX}-${SERVICE}:latest"
             docker build -t "$SRC_IMAGE" -f "services/${SERVICE}/Dockerfile" . || docker build -t "$SRC_IMAGE" -f "${SERVICE}/Dockerfile" "./${SERVICE}"
         fi
    done
    
    # Save standard images to tarball
    docker save -o kavachai_production_images.tar kavachai-worker-service:latest kavachai-policy-service:latest kavachai-trigger-engine:latest kavachai-claims-service:latest kavachai-payment-service:latest kavachai-ml-service:latest kavachai-admin-dashboard:latest
    
    echo "✅ Export complete! You can now transfer exactly to your destination machine:"
    echo "   scp kavachai_production_images.tar user@your-server-ip:~/"
    echo "   On server: docker load -i kavachai_production_images.tar"

elif [ "$ACTION" == "publish" ]; then
    if [ -z "$DOCKER_USERNAME" ]; then
        echo "❌ Error: Docker username is required for publishing."
        echo "Please provide it using: ./export_and_publish_images.sh publish -u <your_username>"
        exit 1
    fi
    
    echo "🔑 Please ensure you are logged in (docker login)"
    
    for SERVICE in "${SERVICES[@]}"; do
         echo "🚀 Pushing ${SERVICE}..."
         
         if [ "${SERVICE}" == "admin-dashboard" ]; then
             docker build -t "${DOCKER_USERNAME}/${IMAGE_PREFIX}-admin-dashboard:latest" -f "admin-dashboard/Dockerfile" ./admin-dashboard
         else
             docker build -t "${DOCKER_USERNAME}/${IMAGE_PREFIX}-${SERVICE//_/-}:latest" -f "services/${SERVICE}/Dockerfile" .
         fi
         
         docker push "${DOCKER_USERNAME}/${IMAGE_PREFIX}-${SERVICE//_/-}:latest"
    done
    
    echo "✅ Publish complete! All images pushed to ${DOCKER_USERNAME}/"
    echo "   You can now update your server's docker-compose.yml to pull these images directly."
fi

echo "🎉 Done!"
