#!/bin/bash

# End-to-End Test Runner for Seaport Orderbook
# This script starts the server and runs the E2E tests

echo "🚀 Starting Seaport Orderbook E2E Tests"
echo "========================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create a .env file with required configuration"
    exit 1
fi

# Load environment variables
source .env

# Check if server is already running
SERVER_RUNNING=$(curl -s http://localhost:5000/health > /dev/null 2>&1 && echo "yes" || echo "no")

if [ "$SERVER_RUNNING" = "yes" ]; then
    echo "✅ Server is already running"
    RUN_TESTS_ONLY=true
else
    echo "🔧 Server not running, will start it"
    RUN_TESTS_ONLY=false
fi

# Function to cleanup on exit
cleanup() {
    if [ "$RUN_TESTS_ONLY" = "false" ]; then
        echo ""
        echo "🧹 Cleaning up..."
        if [ ! -z "$SERVER_PID" ]; then
            echo "Stopping server (PID: $SERVER_PID)..."
            kill $SERVER_PID 2>/dev/null
        fi
    fi
}

trap cleanup EXIT

# Start server if needed
if [ "$RUN_TESTS_ONLY" = "false" ]; then
    echo "🚀 Starting server..."
    node src/server.js > server-test.log 2>&1 &
    SERVER_PID=$!
    
    echo "⏳ Waiting for server to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:5000/health > /dev/null 2>&1; then
            echo "✅ Server is ready!"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "❌ Server failed to start within 30 seconds"
            echo "Check server-test.log for details"
            exit 1
        fi
        sleep 1
    done
fi

# Run E2E tests
echo ""
echo "🧪 Running E2E tests..."
echo "========================================"
node test-seaport-e2e.js

# Capture exit code
TEST_EXIT_CODE=$?

# Exit with test result
exit $TEST_EXIT_CODE
