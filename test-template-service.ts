import { TemplateService } from './packages/sdk/src/services/template.service';

async function run() {
  const url = 'D:\\DEV\\Apps\\AutaKimi\\autakimi-extensions';
  const service = TemplateService.getInstance();
  const res = await service.fetchTemplates(url);
  console.log("RESULT:", res);
}

run().catch(console.error);
