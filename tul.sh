#!/bin/bash
# Quick script to test uploading to daemon with 3 guaranteed-to-work files, for quick development test

cd /Users/balearicfm/Projects/uploadDistributor/packages/daemon && node __tests__/run-upload-test.ts
