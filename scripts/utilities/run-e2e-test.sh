#!/bin/bash

echo "Starting E2E Test..."
echo "This will take about 2 minutes (waiting for 51 blocks)"
echo "=========================================="

cd "$(dirname "$0")"
node test-complete-flow-e2e.js

echo ""
echo "Test completed!"

