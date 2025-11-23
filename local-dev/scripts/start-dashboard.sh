#!/usr/bin/env bash
# Start dashboard dev server with local data
set -euo pipefail

export VITE_DATA_ROOT=../local-dev/data
cd ../dashboard
npm run dev -- --host