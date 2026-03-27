#!/usr/bin/env node
/**
 * AutaKimi Icon Manager — Interactive CLI
 * Run: node scripts/update-icon.mjs
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT       = path.resolve(__dirname, '..')
const BUILD_DIR  = path.join(ROOT, 'build')
const ICONS_DIR  = path.join(BUILD_DIR, 'icons')
const SOURCE_PNG = path.join(ROOT, 'resources', 'icon.png')

// ── Colors ────────────────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',   bold:   '\x1b[1m',
  green:  '\x1b[32m',  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',  red:    '\x1b[31m',
  dim:    '\x1b[2m',   magenta:'\x1b[35m',
}
const ok   = (msg) => console.log(`  ${c.green}✔${c.reset}  ${msg}`)
const fail = (msg) => console.error(`  ${c.red}✘${c.reset}  ${c.bold}${msg}${c.reset}`)
const info = (msg) => console.log(`  ${c.cyan}ℹ${c.reset}  ${msg}`)
const warn = (msg) => console.log(`  ${c.yellow}⚠${c.reset}  ${msg}`)
const step = (n, msg) => console.log(`\n${c.bold}${c.magenta} STEP ${n} ${c.reset}${c.bold} ${msg}${c.reset}`)
const ask  = (rl, q) => new Promise(res => rl.question(q, res))

// ── Banner ────────────────────────────────────────────────────────────────────
function banner() {
  console.clear()
  console.log(`${c.bold}${c.cyan}`)
  console.log('  ╔══════════════════════════════════════════╗')
  console.log('  ║      AutaKimi  ·  Icon Manager  v2.0      ║')
  console.log('  ╚══════════════════════════════════════════╝')
  console.log(c.reset)
  console.log(`  ${c.dim}This wizard will help you update the app icons.${c.reset}\n`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function clearBuildIcons() {
  const targets = [
    path.join(BUILD_DIR, 'icon.ico'),
    path.join(BUILD_DIR, 'icon.icns'),
    path.join(BUILD_DIR, 'icon.png'),
    ICONS_DIR,
  ]
  let removed = 0
  for (const t of targets) {
    if (fs.existsSync(t)) {
      fs.rmSync(t, { recursive: true, force: true })
      removed++
    }
  }
  return removed
}

function runIconBuilder() {
  execSync(
    `npx -y electron-icon-builder --input="${SOURCE_PNG}" --output="${BUILD_DIR}" --flatten`,
    { stdio: 'inherit', cwd: ROOT }
  )
}

function copyFinalIcons() {
  const map = [
    { from: path.join(ICONS_DIR, 'icon.ico'),    to: path.join(BUILD_DIR, 'icon.ico') },
    { from: path.join(ICONS_DIR, 'icon.icns'),   to: path.join(BUILD_DIR, 'icon.icns') },
    { from: path.join(ICONS_DIR, '256x256.png'), to: path.join(BUILD_DIR, 'icon.png') },
  ]
  for (const { from, to } of map) {
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, to)
      ok(`${c.dim}build/${c.reset}${c.bold}${path.basename(to)}${c.reset}`)
    } else {
      warn(`Could not find generated file: ${path.basename(from)}`)
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  banner()

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  // ── STEP 1: Clear old icons ────────────────────────────────────────────────
  step(1, 'Clear Old Icons')
  console.log(`  Removing old icons from: ${c.bold}${BUILD_DIR}${c.reset}`)
  console.log()
  const answer1 = await ask(rl, `  ${c.yellow}?${c.reset} Proceed with clearing? ${c.dim}[Y/n]${c.reset} `)

  if (answer1.trim().toLowerCase() === 'n') {
    warn('Skipped clearing old icons.')
  } else {
    const count = clearBuildIcons()
    ok(`Cleared ${count} existing icon file(s) / folder(s).`)
  }

  // ── STEP 2: User places new icon ───────────────────────────────────────────
  step(2, 'Place Your New Icon')
  console.log()
  console.log(`  ${c.bold}Copy your new icon PNG here:${c.reset}`)
  console.log()
  console.log(`    📂  ${c.cyan}${c.bold}${SOURCE_PNG}${c.reset}`)
  console.log()
  console.log(`  ${c.dim}Requirements:${c.reset}`)
  console.log(`  ${c.dim}  • Format  : PNG${c.reset}`)
  console.log(`  ${c.dim}  • Size    : 1024 × 1024 px (recommended)${c.reset}`)
  console.log(`  ${c.dim}  • Name    : icon.png${c.reset}`)
  console.log()

  let ready = false
  while (!ready) {
    const answer2 = await ask(rl, `  ${c.yellow}?${c.reset} Press ${c.bold}Enter${c.reset} once you've placed the icon (or type ${c.bold}q${c.reset} to quit): `)
    if (answer2.trim().toLowerCase() === 'q') {
      console.log(`\n  ${c.dim}Exiting. No icons were generated.${c.reset}\n`)
      rl.close()
      process.exit(0)
    }
    if (fs.existsSync(SOURCE_PNG)) {
      const stats = fs.statSync(SOURCE_PNG)
      ok(`Found icon.png  ${c.dim}(${(stats.size / 1024).toFixed(1)} KB)${c.reset}`)
      ready = true
    } else {
      fail(`icon.png not found at resources/icon.png — please copy it there first.`)
    }
  }

  // ── STEP 3: Generate icons ─────────────────────────────────────────────────
  step(3, 'Generate All Icon Sizes')
  console.log(`  Running ${c.bold}electron-icon-builder${c.reset}...`)
  console.log()

  try {
    runIconBuilder()
  } catch {
    fail('electron-icon-builder failed. Ensure the PNG is valid and try again.')
    rl.close()
    process.exit(1)
  }

  console.log()
  info('Copying final icons to build/ ...')
  console.log()
  copyFinalIcons()

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log()
  console.log(`  ${c.bold}${c.green}════════════════════════════════════`)
  console.log(`   All icons updated successfully!`)
  console.log(`  ════════════════════════════════════${c.reset}`)
  console.log()
  console.log(`  ${c.dim}Next step: run${c.reset} ${c.bold}npm run build:win${c.reset} ${c.dim}to package the app.${c.reset}`)
  console.log()

  rl.close()
}

main().catch((e) => {
  console.error('\n  Unexpected error:', e.message)
  process.exit(1)
})
