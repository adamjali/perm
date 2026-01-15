#!/bin/bash
set -e

# Cleanup function to stop servers on any exit (success or failure)
cleanup() {
    echo "Stopping servers..."
    kill $CONVEX_PID $NEXTJS_PID 2>/dev/null || true
}
trap cleanup EXIT

echo "Starting Convex dev server..."
npx convex dev > /tmp/convex-e2e.log 2>&1 &
CONVEX_PID=$!

echo "Waiting for Convex to be ready..."
timeout 60 sh -c 'until grep -q "Convex functions ready" /tmp/convex-e2e.log 2>/dev/null; do sleep 1; done'

echo "Starting Next.js dev server..."
pnpm dev > /tmp/nextjs-e2e.log 2>&1 &
NEXTJS_PID=$!

echo "Waiting for Next.js to be ready..."
timeout 60 sh -c 'until grep -q "Ready in" /tmp/nextjs-e2e.log 2>/dev/null; do sleep 1; done'

echo "Running Playwright tests..."
npx playwright test

# Cleanup handled by EXIT trap
echo "Done!"
