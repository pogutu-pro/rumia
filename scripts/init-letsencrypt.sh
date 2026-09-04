#!/usr/bin/env bash

# ==============================================================================
# Let's Encrypt SSL Bootstrap Script for Rumia (rumia.co.ke)
# Runs on fresh Oracle VPS deployment to obtain valid SSL certificates.
# ==============================================================================

set -e

DOMAINS=("rumia.co.ke" "www.rumia.co.ke")
EMAIL="support@rumia.co.ke"
RSA_KEY_SIZE=4096
DATA_PATH="./certbot"
STAGING=0 # Set to 1 if testing to avoid hitting Let's Encrypt rate limits

if [ -d "$DATA_PATH/conf/live/${DOMAINS[0]}" ]; then
  read -p "Existing certificates found for ${DOMAINS[0]}. Replace? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit 0
  fi
fi

echo "### Creating dummy certificate for ${DOMAINS[0]} ..."
mkdir -p "$DATA_PATH/conf/live/${DOMAINS[0]}"
mkdir -p "$DATA_PATH/www"

docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1\
    -keyout '/etc/letsencrypt/live/${DOMAINS[0]}/privkey.pem' \
    -out '/etc/letsencrypt/live/${DOMAINS[0]}/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "### Starting Nginx ..."
docker compose up --force-recreate -d nginx

echo "### Deleting dummy certificate ..."
docker compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/${DOMAINS[0]} && \
  rm -Rf /etc/letsencrypt/archive/${DOMAINS[0]} && \
  rm -Rf /etc/letsencrypt/renewal/${DOMAINS[0]}.conf" certbot

echo "### Requesting Let's Encrypt certificate for ${DOMAINS[*]} ..."
domain_args=""
for domain in "${DOMAINS[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select email arg
case "$EMAIL" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $EMAIL" ;;
esac

# Enable staging if needed
if [ $STAGING != "0" ]; then staging_arg="--staging"; fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos \
    --force-renewal" certbot

echo "### Reloading Nginx ..."
docker compose exec nginx nginx -s reload

echo "=== SSL Initialization Complete! Production certificates active for ${DOMAINS[*]} ==="
