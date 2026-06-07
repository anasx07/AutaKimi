const fs = require('fs');

const code = `import * as fs from 'fs'
import * as path from 'path'
import * as esbuild from 'esbuild'

const EXTENSIONS_DIR = __dirname
const SRC_DIR = path.join(EXTENSIONS_DIR, 'src')
const TEMPLATES_SRC_DIR = path.join(SRC_DIR, 'templates')
const PLUGINS_SRC_DIR = path.join(SRC_DIR, 'plugins')
const DIST_DIR = path.join(EXTENSIONS_DIR, 'dist')
const JS_OUT_DIR = path.join(DIST_DIR, 'js')

function buildTemplates() {
  console.log('Building templates...')
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true })
  const templatesFile = path.join(DIST_DIR, 'templates.json')
  
  const pkgPath = path.join(EXTENSIONS_DIR, 'package.json')
  const pkgVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || '1.0.0'
  
  const sourceTemplatesFile = path.join(EXTENSIONS_DIR, 'templates.json')
  let existingData: { version: string; templates: any[] } = { version: pkgVersion, templates: [] }
  if (fs.existsSync(sourceTemplatesFile)) {
    try {
      existingData = JSON.parse(fs.readFileSync(sourceTemplatesFile, 'utf8'))
      existingData.version = pkgVersion
    } catch (e) { }
  }

  const templateFiles = fs.existsSync(TEMPLATES_SRC_DIR) ? fs.readdirSync(TEMPLATES_SRC_DIR).filter(f => f.endsWith('.ts') || f.endsWith('.js')) : []
  const builtTemplates: any[] = []

  for (const file of templateFiles) {
    const filePath = path.join(TEMPLATES_SRC_DIR, file)
    const id = path.parse(file).name
    const fileContent = fs.readFileSync(filePath, 'utf8')

    const startIdx = fileContent.indexOf('return \`')
    const endIdx = fileContent.lastIndexOf('\`')

    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) continue

    const generatorCode = fileContent.slice(startIdx, endIdx + 1).trim()
    const existing = existingData.templates.find(t => t.id === id)
    const name = existing ? existing.name : id.charAt(0).toUpperCase() + id.slice(1)

    builtTemplates.push({ id, name, generator: generatorCode })
    console.log(\`  - Built template: \${id}\`)
  }

  existingData.templates = builtTemplates
  fs.writeFileSync(templatesFile, JSON.stringify(existingData, null, 2) + '\\n', 'utf8')
}

function buildPlugins() {
  console.log('Building plugins...')
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true })
  const pluginsFile = path.join(DIST_DIR, 'plugins.json')

  const pkgPath = path.join(EXTENSIONS_DIR, 'package.json')
  const pkgVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || '1.0.0'

  const sourcePluginsFile = path.join(EXTENSIONS_DIR, 'plugins.json')
  let existingData: { version: string; plugins: any[] } = { version: pkgVersion, plugins: [] }
  if (fs.existsSync(sourcePluginsFile)) {
    try {
      existingData = JSON.parse(fs.readFileSync(sourcePluginsFile, 'utf8'))
      existingData.version = pkgVersion
    } catch (e) { }
  }

  const pluginFiles = fs.existsSync(PLUGINS_SRC_DIR) ? fs.readdirSync(PLUGINS_SRC_DIR).filter(f => f.endsWith('.ts') || f.endsWith('.js')) : []
  const builtPlugins: any[] = []

  for (const file of pluginFiles) {
    const filePath = path.join(PLUGINS_SRC_DIR, file)
    const id = path.parse(file).name
    const fileContent = fs.readFileSync(filePath, 'utf8')

    const firstBrace = fileContent.indexOf('{')
    const lastBrace = fileContent.lastIndexOf('}')

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) continue

    const body = fileContent.slice(firstBrace + 1, lastBrace).trim()
    const pluginCode = \`return async (context) => {\\n\${body}\\n}\`

    const existing = existingData.plugins.find(p => p.id === id)
    
    builtPlugins.push({
      id,
      name: existing ? existing.name : id.charAt(0).toUpperCase() + id.slice(1),
      description: existing ? existing.description : '',
      author: existing ? existing.author : 'AutaKimi Community',
      version: existing ? existing.version : '1.0.0',
      target: existing ? existing.target : 'main-cloudflare',
      code: pluginCode
    })
    console.log(\`  - Built plugin: \${id}\`)
  }

  existingData.plugins = builtPlugins
  fs.writeFileSync(pluginsFile, JSON.stringify(existingData, null, 2) + '\\n', 'utf8')
}

const EXTENSIONS_SRC_DIR = path.join(SRC_DIR, 'extensions')

async function buildExtensionsAndCatalogs() {
  console.log('Building extensions and catalogs...')
  if (!fs.existsSync(JS_OUT_DIR)) fs.mkdirSync(JS_OUT_DIR, { recursive: true })

  const mangaCatalogs: Record<string, any[]> = {}
  const animeCatalogs: Record<string, any[]> = {}
  const mangaSources: any[] = []
  const animeSources: any[] = []

  if (fs.existsSync(EXTENSIONS_SRC_DIR)) {
    const types = fs.readdirSync(EXTENSIONS_SRC_DIR)
    for (const type of types) {
      const typePath = path.join(EXTENSIONS_SRC_DIR, type)
      if (!fs.statSync(typePath).isDirectory()) continue
      
      const langs = fs.readdirSync(typePath)
      for (const lang of langs) {
        const langPath = path.join(typePath, lang)
        if (!fs.statSync(langPath).isDirectory()) continue
        
        const exts = fs.readdirSync(langPath)
        for (const ext of exts) {
          const extPath = path.join(langPath, ext)
          if (!fs.statSync(extPath).isDirectory()) continue
          
          const indexPath = path.join(extPath, 'index.ts')
          if (!fs.existsSync(indexPath)) continue

          const fileContent = fs.readFileSync(indexPath, 'utf8')
          const configMatch = fileContent.match(/export const config = (\\{[\\s\\S]*?\\});?$/m)
          if (!configMatch) {
            console.error(\`[Error] Extension \${indexPath} does not export a config object. skipping.\`)
            continue
          }

          let config: any;
          try {
            config = eval('(' + configMatch[1] + ')')
          } catch (e) {
            console.error(\`[Error] Failed to parse config for \${indexPath}:\`, e)
            continue
          }

          const id = config.pkg
          
          const sourceObj = {
            id: config.pkg,
            name: config.name,
            url: config.sources && config.sources[0] ? config.sources[0].baseUrl : '',
            templateId: config.templateId || undefined,
            icon: \`autakimi-cache://local-icon/\${config.pkg}.png\`,
            nsfw: config.nsfw === 1 || config.nsfw === true,
            language: config.lang || 'all'
          }

          const catalogEntry = config

          if (type === 'manga') {
            if (!mangaCatalogs[config.lang]) mangaCatalogs[config.lang] = []
            mangaCatalogs[config.lang].push(catalogEntry)
            mangaSources.push(sourceObj)
          } else {
            if (!animeCatalogs[config.lang]) animeCatalogs[config.lang] = []
            animeCatalogs[config.lang].push(catalogEntry)
            animeSources.push(sourceObj)
          }

          const iconPath = path.join(extPath, 'icon.png')
          if (fs.existsSync(iconPath)) {
            const distIconsDir = path.join(DIST_DIR, 'icons')
            if (!fs.existsSync(distIconsDir)) fs.mkdirSync(distIconsDir, { recursive: true })
            fs.copyFileSync(iconPath, path.join(distIconsDir, \`\${id}.png\`))
          }

          if (config.baseClass === 'Native') {
            const classMatch = fileContent.match(/export\\s+class\\s+([A-Za-z0-9_]+)/)
            if (!classMatch) {
              console.error(\`[Error] Native extension \${indexPath} does not export a class. skipping.\`)
              continue
            }
            const className = classMatch[1]
            const outPath = path.join(JS_OUT_DIR, \`\${id}.js\`)
            const tmpEntryPath = path.join(extPath, \`_\${id}_entry.ts\`)
            const entryCode = \`
import { \${className} } from './index';
import { executeExtension } from '../../../../base/sandboxDispatcher';

declare const params: any;

const source = new \${className}();
export default executeExtension(source, params);
\`
            fs.writeFileSync(tmpEntryPath, entryCode, 'utf8')

            try {
              await esbuild.build({
                entryPoints: [tmpEntryPath],
                bundle: true,
                outfile: outPath,
                format: 'iife',
                globalName: 'extension_module',
                target: 'es2020',
                platform: 'browser',
                external: ['cheerio'],
                minify: true,
              })

              const bundledCode = fs.readFileSync(outPath, 'utf8')
              fs.writeFileSync(outPath, bundledCode + '\\nreturn extension_module.default;\\n', 'utf8')
              console.log(\`  - Built native extension: \${id}\`)
            } catch (e: any) {
              console.error(\`  - Failed to build native extension: \${id}\`, e.message)
            } finally {
              if (fs.existsSync(tmpEntryPath)) fs.unlinkSync(tmpEntryPath)
            }
          }
        }
      }
    }
  }

  const writeCatalogs = (catalogs: Record<string, any[]>, catalogName: string, sourcesName: string, sourcesArr: any[]) => {
    const pkgVersion = JSON.parse(fs.readFileSync(path.join(EXTENSIONS_DIR, 'package.json'), 'utf8')).version || '1.0.0'
    
    fs.writeFileSync(path.join(DIST_DIR, sourcesName), JSON.stringify({
      version: pkgVersion,
      [sourcesName.replace('.json', '')]: sourcesArr
    }, null, 2), 'utf8')

    const catalogDir = path.join(DIST_DIR, catalogName, 'extensions')
    if (!fs.existsSync(catalogDir)) fs.mkdirSync(catalogDir, { recursive: true })
    
    const langMap: Record<string, string> = {
      'ar': 'Arabic', 'en': 'English', 'all': 'Global', 'es': 'Spanish', 'fr': 'French',
      'id': 'Indonesian', 'it': 'Italian', 'ja': 'Japanese', 'ko': 'Korean', 'pl': 'Polish',
      'pt-br': 'Portuguese-Brazil', 'ru': 'Russian', 'th': 'Thai', 'tr': 'Turkish', 'uk': 'Ukrainian', 'vi': 'Vietnamese'
    }

    const availableCatalogs: string[] = []
    for (const [lang, exts] of Object.entries(catalogs)) {
      const fileName = \`\${langMap[lang] || lang}.json\`
      availableCatalogs.push(\`extensions/\${fileName}\`)
      fs.writeFileSync(path.join(catalogDir, fileName), JSON.stringify(exts, null, 2), 'utf8')
    }

    fs.writeFileSync(path.join(DIST_DIR, catalogName === 'MangaCatalogs' ? 'manga_catalogs.json' : 'anime_catalogs.json'), JSON.stringify({
      version: "1.1.0",
      catalogs: availableCatalogs
    }, null, 2), 'utf8')
  }

  writeCatalogs(mangaCatalogs, 'MangaCatalogs', 'manga_sources.json', mangaSources)
  writeCatalogs(animeCatalogs, 'AnimeCatalogs', 'anime_sources.json', animeSources)
}

async function run() {
  try {
    buildTemplates()
    buildPlugins()
    await buildExtensionsAndCatalogs()
    console.log('Build pipeline completed successfully.')
  } catch (e: any) {
    console.error('Build execution failed:', e.message)
    process.exit(1)
  }
}

run()
`;

fs.writeFileSync('D:/DEV/Apps/AutaKimi/autakimi-extensions/build.ts', code, 'utf8');
