#!/bin/bash
set -e

cd /home/runner/workspace

npx vite build --config frontend/vite.config.ts
