#!/bin/bash
# Quick script to test uploading to daemon with 3 guaranteed-to-work files, for quick development test

# Note: To switch between mock and real API, edit the AzuraCastService.ts file
# and comment/uncomment the appropriate sections for each step of the upload process.

echo "Running upload test..."
cd /Users/balearicfm/Projects/uploadDistributor/packages/daemon && node __tests__/run-upload-test.ts
