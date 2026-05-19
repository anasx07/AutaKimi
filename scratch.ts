import { sourceService } from './packages/sdk/src/services/source.service';

async function test() {
  console.log("Testing loadAllRepositories...");
  const res = await sourceService.loadAllRepositories(['https://raw.githubusercontent.com/Autakimi-Ecosystem/autakimi-extensions/main/templates.json']);
  console.log("Result:", res);
  console.log("Sources count:", sourceService.getAllSources().length);
}

test().catch(console.error);
