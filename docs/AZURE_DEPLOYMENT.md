# Azure Container Apps Deployment Guide

This guide covers deploying Jaunty using Azure Container Registry (ACR) for image builds and Azure Container Apps for hosting. No local Docker installation required.

## Current Configuration

- Registry: `your-registry.azurecr.io`
- Backend URL: `https://your-backend.your-environment.eastus.azurecontainerapps.io`
- Frontend URL: `https://www.your-domain.com`
- Environment FQDN: `your-environment.eastus.azurecontainerapps.io`
- Resource Group: `your-resource-group`
- Location: `eastus`

## Prerequisites

- Azure CLI installed
- Azure account logged in: `az login`
- Active subscription with Container Apps enabled

## First-Time Setup

Run these commands once to create the required Azure resources.

### 1. Create Resource Group

```bash
az group create --name your-resource-group --location eastus
```

### 2. Create Container Registry

```bash
az acr create \
  --name your-registry \
  --resource-group your-resource-group \
  --sku Basic \
  --admin-enabled true
```

### 3. Create Container Apps Environment

```bash
az containerapp env create \
  --name jaunty-env \
  --resource-group your-resource-group \
  --location eastus
```

### 4. Get ACR Credentials

Store these credentials - you'll need them when creating container apps:

```bash
az acr credential show \
  --name your-registry \
  --resource-group your-resource-group
```

Output will show `username` and `password` fields.

## Building and Pushing Images

Use `az acr build` to build images in Azure without local Docker.

### Backend Image

Run from project root:

```bash
az acr build \
  --registry your-registry \
  --image jaunty-backend:latest \
  --file backend/Dockerfile \
  .
```

### Frontend Image

Run from project root:

```bash
az acr build \
  --registry your-registry \
  --image jaunty-frontend:latest \
  --file Dockerfile.frontend \
  --build-arg VITE_API_URL=https://your-backend.your-environment.eastus.azurecontainerapps.io \
  .
```

Note: Update `VITE_API_URL` if your backend URL changes.

## Creating Container Apps (First Time)

### Backend Container App

```bash
az containerapp create \
  --name jaunty-backend \
  --resource-group your-resource-group \
  --environment jaunty-env \
  --image your-registry.azurecr.io/jaunty-backend:latest \
  --target-port 8000 \
  --ingress external \
  --registry-server your-registry.azurecr.io \
  --registry-username <USERNAME_FROM_STEP_4> \
  --registry-password <PASSWORD_FROM_STEP_4> \
  --cpu 0.5 \
  --memory 1Gi \
  --min-replicas 1 \
  --max-replicas 3
```

### Configure Backend CORS

After backend creation, update CORS settings to allow frontend access:

```bash
az containerapp ingress cors update \
  --name jaunty-backend \
  --resource-group your-resource-group \
  --allowed-origins "https://www.your-domain.com" "https://your-frontend.your-environment.eastus.azurecontainerapps.io" \
  --allowed-methods GET POST PUT DELETE OPTIONS \
  --allowed-headers "*"
```

### Frontend Container App

```bash
az containerapp create \
  --name jaunty-frontend \
  --resource-group your-resource-group \
  --environment jaunty-env \
  --image your-registry.azurecr.io/jaunty-frontend:latest \
  --target-port 80 \
  --ingress external \
  --registry-server your-registry.azurecr.io \
  --registry-username <USERNAME_FROM_STEP_4> \
  --registry-password <PASSWORD_FROM_STEP_4> \
  --cpu 0.25 \
  --memory 0.5Gi \
  --min-replicas 1 \
  --max-replicas 2
```

## Updating Deployments

After code changes, rebuild images and update container apps.

### 1. Rebuild Images

```bash
# Backend
az acr build \
  --registry your-registry \
  --image jaunty-backend:latest \
  --file backend/Dockerfile \
  .

# Frontend
az acr build \
  --registry your-registry \
  --image jaunty-frontend:latest \
  --file Dockerfile.frontend \
  --build-arg VITE_API_URL=https://your-backend.your-environment.eastus.azurecontainerapps.io \
  .
```

### 2. Update Container Apps

Force apps to pull and deploy new images:

```bash
# Backend
az containerapp update \
  --name jaunty-backend \
  --resource-group your-resource-group \
  --image your-registry.azurecr.io/jaunty-backend:latest

# Frontend
az containerapp update \
  --name jaunty-frontend \
  --resource-group your-resource-group \
  --image your-registry.azurecr.io/jaunty-frontend:latest
```

Container Apps will pull the new images and restart automatically.

## Custom Domain Setup

The frontend can use a custom domain configured through your DNS provider.

### DNS Configuration

In your DNS provider, add a CNAME record:

- Type: `CNAME`
- Name: `www`
- Value: `your-frontend.your-environment.eastus.azurecontainerapps.io`
- TTL: 600 seconds (or default)

### Add Custom Domain to Container App

```bash
az containerapp hostname add \
  --hostname www.your-domain.com \
  --name jaunty-frontend \
  --resource-group your-resource-group
```

### Enable Managed Certificate

```bash
az containerapp hostname bind \
  --hostname www.your-domain.com \
  --name jaunty-frontend \
  --resource-group your-resource-group \
  --environment jaunty-env \
  --validation-method HTTP
```

Azure will automatically provision and manage a free SSL certificate.

## Monitoring and Troubleshooting

### View Application Logs

```bash
# Backend logs (last 50 lines)
az containerapp logs show \
  --name jaunty-backend \
  --resource-group your-resource-group \
  --tail 50

# Frontend logs
az containerapp logs show \
  --name jaunty-frontend \
  --resource-group your-resource-group \
  --tail 50

# Follow logs in real-time
az containerapp logs show \
  --name jaunty-backend \
  --resource-group your-resource-group \
  --follow
```

### Check Application Status

```bash
# Backend status
az containerapp show \
  --name jaunty-backend \
  --resource-group your-resource-group \
  --query properties.runningStatus

# Frontend status
az containerapp show \
  --name jaunty-frontend \
  --resource-group your-resource-group \
  --query properties.runningStatus
```

### View Full Configuration

```bash
az containerapp show \
  --name jaunty-backend \
  --resource-group your-resource-group
```

### Check Image Registry

List images in ACR:

```bash
az acr repository list \
  --name your-registry

# View tags for specific image
az acr repository show-tags \
  --name your-registry \
  --repository jaunty-backend
```

### Common Issues

**Image pull failures**: Verify ACR credentials are correct in container app configuration.

**CORS errors**: Check backend CORS settings match frontend domain.

**SSL certificate provisioning**: DNS changes can take up to 48 hours to propagate. Certificate validation requires HTTP traffic to reach the container app.

**Application not responding**: Check logs for startup errors. Verify target port matches application configuration.

## Resource Management

### Scale Manually

```bash
az containerapp update \
  --name jaunty-backend \
  --resource-group your-resource-group \
  --min-replicas 2 \
  --max-replicas 5
```

### Delete Resources

Delete individual apps:

```bash
az containerapp delete \
  --name jaunty-backend \
  --resource-group your-resource-group

az containerapp delete \
  --name jaunty-frontend \
  --resource-group your-resource-group
```

Delete entire resource group (removes all resources):

```bash
az group delete \
  --name your-resource-group \
  --yes
```

## Cost Optimization

Container Apps pricing is based on vCPU and memory allocation. Current configuration:

- Backend: 0.5 vCPU, 1 GB memory, 1-3 replicas
- Frontend: 0.25 vCPU, 0.5 GB memory, 1-2 replicas

Container Apps scale to zero when idle. You only pay for active usage.

To minimize costs:
- Set `--min-replicas 0` for non-production environments
- Reduce CPU/memory allocations if application permits
- Use Basic SKU for ACR (current configuration)
