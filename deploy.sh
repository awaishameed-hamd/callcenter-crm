#!/usr/bin/env bash
# Hostinger deployment script — run via SSH from the project root.
# Usage: bash deploy.sh

set -euo pipefail

echo "==> Installing Composer dependencies (production)..."
composer install --no-dev --optimize-autoloader

echo "==> Caching config..."
php artisan config:cache

echo "==> Caching routes..."
php artisan route:cache

echo "==> Caching views..."
php artisan view:cache

echo "==> Running migrations..."
php artisan migrate --force

echo "==> Done. Deployment complete."
