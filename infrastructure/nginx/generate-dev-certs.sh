#!/bin/sh
# Generate self-signed TLS cert for local dev/testing.
# Run once before first docker compose up:
#   sh infrastructure/nginx/generate-dev-certs.sh
#
# Replace with real cert (Let's Encrypt / VNPT CA) before production deploy.

set -e

CERT_DIR="$(dirname "$0")/certs"
mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.crt" \
  -subj "/C=VN/ST=Dong Thap/L=Cao Lanh/O=VNPT/CN=localhost"

echo "Dev certs written to $CERT_DIR/"
echo "  server.crt  (public cert)"
echo "  server.key  (private key — keep out of git)"
