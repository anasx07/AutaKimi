import { tryReadLocalFileSafe } from './packages/sdk/src/services/localFileInterceptor.ts';
import path from 'path';

async function run() {
  const url1 = 'D:\\DEV\\Apps\\AutaKimi\\autakimi-extensions/js/ma.autakimi.extension.ar.mangasid.js';
  const url2 = 'https://raw.githubusercontent.com/Autakimi-Ecosystem/autakimi-extensions/main/js/ma.autakimi.extension.ar.mangasid.js';
  
  console.log('Testing direct local path:', url1);
  const res1 = tryReadLocalFileSafe(url1);
  if (res1 && res1.ok) {
    console.log('SUCCESS direct path, body length:', (await res1.value.text()).length);
  } else {
    console.log('FAILED direct path:', res1);
  }

  console.log('Testing github intercept path:', url2);
  const res2 = tryReadLocalFileSafe(url2);
  if (res2 && res2.ok) {
    console.log('SUCCESS intercept path, body length:', (await res2.value.text()).length);
  } else {
    console.log('FAILED intercept path:', res2);
  }
}

run().catch(console.error);
