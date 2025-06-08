# Upload Test Issues and Solutions

This document outlines the issues identified in the AzuraCast upload test process and the solutions implemented.

## Issues Identified

### 1. DJ Name Mismatch

**Problem**: When a Super Admin uploads on behalf of a DJ, the DJ name wasn't being properly set in the metadata, causing issues when looking up the DJ's playlist.

**Solution**: Modified `packages/daemon/__tests__/run-upload-test.ts` to explicitly set the DJ name in the metadata:

```javascript
const metadata = {
  // ...other fields
  selectedDjId: '1', // ID for DJ "catalyst"
  djName: 'catalyst' // Explicitly set the DJ name to match the selected DJ
};
```

This ensures that the correct DJ name is used throughout the process, particularly when looking up the DJ's playlist.

### 2. Mock vs Real API Implementation

**Problem**: During development, switching between mock and real AzuraCast API calls was needed for testing different scenarios.

**Solution**: Implemented a commenting approach in `AzuraCastService.ts` where each upload step has clearly marked sections for "APPROACH 1: Use Mock API" and "APPROACH 2: Use Real API". Developers can comment/uncomment the appropriate sections to switch between implementations.

This approach proved more reliable than environment variable configuration flags and allows for easy switching between mock and real implementations during development.

### 3. Error Reporting

**Problem**: Errors in the upload process weren't being properly reported and logged.

**Solution**: 
1. Enhanced `packages/daemon/__tests__/run-upload-test.ts` to properly check for errors in the upload process:

```javascript
// Check if there was an error in the upload
if (status === 'error' || message.includes('error') || message.includes('failed')) {
  console.log('\n❌ Test failed with error status in archive');
  console.log(`Error message: ${message}`);
  process.exit(1);
}
```

2. Modified `packages/daemon/src/services/StatusManager.ts` to ensure that errors are properly logged to the destination-status.log file:

```javascript
// Log to destination-status.log
fs.appendFileSync(statusLogPath, logEntry + '\n');
```

## Testing Process

To test the AzuraCast upload functionality:

1. First, build and run the daemon:
   ```bash
   ./brund.sh
   ```
   This script:
   - Builds the logging package
   - Builds the daemon package
   - Starts the daemon

2. In a separate terminal, run the upload test:
   ```bash
   # For testing with mock AzuraCast API:
   ./tul.sh
   
   # OR for testing with real AzuraCast API:
   ./tul.sh --real-upload
   ```

The test script will:
1. Run the upload test against the running daemon
2. Monitor the status of the upload
3. Report success or failure

## Checking Logs

After running the test, you can check the logs for more details:

- Console output from the daemon terminal
- `packages/daemon/logs/destination-status.log` - Contains success and error logs for all destinations
- `packages/daemon/logs/destination-errors.log` - Contains detailed error logs with additional context

## Troubleshooting

If the test fails:

1. Check the error message in the test output
2. Check the daemon console for detailed logs
3. Check the destination log files for more context
4. Verify that the daemon is running and accessible at http://localhost:3001
5. Ensure the test files exist in the `apps/tf` directory
