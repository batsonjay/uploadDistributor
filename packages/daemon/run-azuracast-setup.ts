/**
 * Run AzuraCast Setup Tasks
 * 
 * This script runs the one-time setup tasks for AzuraCast integration.
 * It fetches and logs the podcast ID for the station and validates
 * playlist availability for known DJ names.
 * 
 * Usage:
 * ```
 * npx ts-node packages/daemon/run-azuracast-setup.ts
 * ```
 */

import { runAzuraCastSetupTasks } from './src/utils/runAzuraCastSetupTasks.js';

// Run the setup tasks
console.log('Starting AzuraCast setup tasks...');

runAzuraCastSetupTasks()
  .then(() => {
    console.log('✅ Setup tasks completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup tasks failed:', error);
    process.exit(1);
  });
