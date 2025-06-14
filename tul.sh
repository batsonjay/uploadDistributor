#!/bin/bash
# Quick script to test uploading to daemon with 3 guaranteed-to-work files, for quick development test
# Usage: ./tul.sh [--admin]
#   ./tul.sh          - Test as regular DJ (using TARGET_DJ_NAME)
#   ./tul.sh --admin  - Test as admin uploading for TARGET_DJ_NAME

TARGET_DJ_NAME="${TARGET_DJ_NAME:-catalyst}"

# Parse command line arguments
ADMIN_MODE=false
if [[ "$1" == "--admin" ]]; then
    ADMIN_MODE=true
fi

# Display mode
if [[ "$ADMIN_MODE" == "true" ]]; then
    echo "Admin mode: uploading for DJ '$TARGET_DJ_NAME'"
else
    echo "Regular DJ mode: testing as '$TARGET_DJ_NAME'"
fi

# Pass variables to test script
cd /Users/balearicfm/Projects/uploadDistributor/packages/daemon && \
TARGET_DJ_NAME="$TARGET_DJ_NAME" \
ADMIN_MODE="$ADMIN_MODE" \
npm run test:upload

# Handle exit code
exit_code=$?
if [ $exit_code -eq 0 ]; then
    echo "✅ Upload test completed successfully!"
else
    echo "❌ Upload test failed with exit code: $exit_code"
    echo "Check the daemon logs for detailed error information."
fi
exit $exit_code
