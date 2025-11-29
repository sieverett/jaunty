#!/usr/bin/env bash

set -e  # Exit on any error
set -o pipefail  # Exit on pipe failures

# Configuration
RESOURCE_GROUP="your-resource-group"
ACR_NAME="your-registry"
BACKEND_APP="jaunty-backend"
FRONTEND_APP="jaunty-frontend"
BACKEND_URL="https://your-backend.your-environment.eastus.azurecontainerapps.io"

# Script variables
DRY_RUN=false
DEPLOY_BACKEND=false
DEPLOY_FRONTEND=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output (optional, can be removed if too fancy)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
show_usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] [COMPONENT]

Deploy Jaunty application components to Azure Container Apps.

COMPONENT:
    frontend        Deploy only the frontend application
    backend         Deploy only the backend application
    (no argument)   Deploy both frontend and backend

OPTIONS:
    --dry-run       Show commands without executing them
    --help, -h      Show this help message

EXAMPLES:
    $(basename "$0")                    # Deploy both components
    $(basename "$0") frontend           # Deploy frontend only
    $(basename "$0") backend            # Deploy backend only
    $(basename "$0") --dry-run frontend # Show frontend deployment commands

CONFIGURATION:
    Resource Group: $RESOURCE_GROUP
    Container Registry: $ACR_NAME
    Backend App: $BACKEND_APP
    Frontend App: $FRONTEND_APP
    Backend URL: $BACKEND_URL

EOF
}

log_info() {
    echo "[INFO] $1"
}

log_success() {
    echo "[SUCCESS] $1"
}

log_error() {
    echo "[ERROR] $1" >&2
}

log_warning() {
    echo "[WARNING] $1"
}

run_command() {
    if [ "$DRY_RUN" = true ]; then
        echo "[DRY-RUN] $*"
    else
        log_info "Executing: $*"
        "$@"
    fi
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if az CLI is installed
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI (az) is not installed. Please install it first."
        log_error "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi

    # Check if logged in
    if ! az account show &> /dev/null; then
        log_error "Not logged in to Azure CLI. Please run 'az login' first."
        exit 1
    fi

    log_success "Prerequisites check passed"
}

deploy_backend() {
    log_info "Starting backend deployment..."

    # Build and push backend image to ACR
    log_info "Building backend Docker image in ACR..."
    run_command az acr build \
        --registry "$ACR_NAME" \
        --image "$BACKEND_APP:latest" \
        --file "$PROJECT_ROOT/backend/Dockerfile" \
        "$PROJECT_ROOT"

    # Update container app to pull new image
    log_info "Updating backend container app..."
    run_command az containerapp update \
        --name "$BACKEND_APP" \
        --resource-group "$RESOURCE_GROUP" \
        --image "$ACR_NAME.azurecr.io/$BACKEND_APP:latest"

    log_success "Backend deployment completed"
}

deploy_frontend() {
    log_info "Starting frontend deployment..."

    # Build and push frontend image to ACR with build arg
    log_info "Building frontend Docker image in ACR..."
    run_command az acr build \
        --registry "$ACR_NAME" \
        --image "$FRONTEND_APP:latest" \
        --build-arg "VITE_API_URL=$BACKEND_URL" \
        --file "$PROJECT_ROOT/Dockerfile.frontend" \
        "$PROJECT_ROOT"

    # Update container app to pull new image
    log_info "Updating frontend container app..."
    run_command az containerapp update \
        --name "$FRONTEND_APP" \
        --resource-group "$RESOURCE_GROUP" \
        --image "$ACR_NAME.azurecr.io/$FRONTEND_APP:latest"

    log_success "Frontend deployment completed"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_usage
            exit 0
            ;;
        --dry-run)
            DRY_RUN=true
            log_warning "Running in DRY-RUN mode - no commands will be executed"
            shift
            ;;
        frontend)
            DEPLOY_FRONTEND=true
            shift
            ;;
        backend)
            DEPLOY_BACKEND=true
            shift
            ;;
        *)
            log_error "Unknown argument: $1"
            show_usage
            exit 1
            ;;
    esac
done

# If no component specified, deploy both
if [ "$DEPLOY_BACKEND" = false ] && [ "$DEPLOY_FRONTEND" = false ]; then
    DEPLOY_BACKEND=true
    DEPLOY_FRONTEND=true
fi

# Main execution
main() {
    log_info "Jaunty Azure Deployment Script"
    log_info "Project root: $PROJECT_ROOT"

    check_prerequisites

    if [ "$DEPLOY_BACKEND" = true ]; then
        deploy_backend
    fi

    if [ "$DEPLOY_FRONTEND" = true ]; then
        deploy_frontend
    fi

    log_success "Deployment completed successfully"
}

# Run main function
main
