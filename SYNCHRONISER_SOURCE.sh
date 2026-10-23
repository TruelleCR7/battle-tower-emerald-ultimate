#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
python3 sync_pokeemerald.py
python3 pack_site.py
