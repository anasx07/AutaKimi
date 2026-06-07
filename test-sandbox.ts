import { WorkerPool } from './apps/desktop/src/main/services/worker/worker.pool';
import * as fs from 'fs';

async function run() {
  const pool = new WorkerPool();
  try {
    const code = fs.readFileSync('D:\\DEV\\Apps\\AutaKimi\\autakimi-extensions\\js\\ma.autakimi.extension.ar.mangasid.js', 'utf8');
    const res = await pool.runInSandbox(code, { type: 'fetchPopular', activeFeed: 'popular', limit: 15, offset: 0, lang: 'ar' }, 'ma.autakimi.extension.ar.mangasid');
    console.log('Result:', JSON.stringify(res, null, 2).slice(0, 500));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    pool.shutdown();
  }
}
run();
