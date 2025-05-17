import { workerData, parentPort } from 'worker_threads';
import { processFile } from './file-processor.js';

if (!parentPort) {
  throw new Error('Worker must be run as a worker thread');
}

(async () => {
  try {
    await processFile(workerData);
    parentPort?.postMessage({ success: true });
  } catch (err) {
    parentPort?.postMessage({ success: false, error: (err as Error).message });
  }
})();
