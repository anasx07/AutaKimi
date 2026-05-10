import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query) => new Promise((resolve) => rl.question(query, resolve))

// ANSI Colors
const C = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  bg: '\x1b[45m\x1b[37m'
}

const printHeader = () => {
  console.clear()
  console.log(`${C.magenta}${C.bright}
  ▄▀█ █ █ ▀█▀ ▄▀█ █▄▀ █ █▀▄▀█ █
  █▀█ █▄█  █  █▀█ █ ▀ █ █ ▀ █ █  vRELEASE
  ${C.reset}`)
  console.log(`${C.dim}───────────────────────────────────────────${C.reset}\n`)
}

async function main() {
  try {
    printHeader()

    // 0. Build Check
    console.log(`${C.cyan}${C.bright}Running Build Check...${C.reset}\n`)
    try {
      execSync('npm run build', { stdio: 'inherit' })
      console.log(`\n${C.green}✓${C.reset} Build successful!\n`)
    } catch (error) {
      console.log(`\n${C.red}${C.bright}Build Failed!${C.reset}`)
      console.log(
        `${C.yellow}${C.bright}Please Fix these errors and Come again for Release${C.reset}\n`
      )
      return
    }

    // 1. Get current version
    while (true) {
      try {
        printHeader()
        const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
        console.log(`${C.cyan}Current Version:${C.reset} ${C.bright}${pkg.version}${C.reset}\n`)

        // 2. Show Menu
        console.log(`${C.bright}SELECT RELEASE MODE:${C.reset}`)
        console.log(
          `${C.green}  (1)${C.reset} ${C.bright}Full Release${C.reset}       ${C.dim}(Stage All -> Commit -> Tag -> Push)${C.reset}`
        )
        console.log(
          `${C.yellow}  (2)${C.reset} ${C.bright}Version Only${C.reset}       ${C.dim}(Stage package.json -> Tag -> Push)${C.reset}`
        )
        console.log(
          `${C.magenta}  (3)${C.reset} ${C.bright}Tag Only${C.reset}           ${C.dim}(Skip package.json, push vTag only)${C.reset}`
        )
        console.log(`${C.red}  (0)${C.reset} ${C.bright}Cancel${C.reset}`)

        const choice = await question(`\n${C.cyan}${C.bright}» Choose [1-3, 0]:${C.reset} `)

        if (choice === '0' || !['1', '2', '3'].includes(choice)) {
          console.log(`\n${C.dim}Operation cancelled.${C.reset}`)
          break
        }

        // 3. Version Handling
        let newVersion = pkg.version
        if (choice === '1' || choice === '2') {
          newVersion = await question(
            `${C.cyan}${C.bright}» Target Version (e.g. 1.0.6):${C.reset} `
          )
          if (!newVersion) {
            console.log(`${C.red}Invalid version. Cancelled.${C.reset}`)
            await question(`\n${C.yellow}Press Enter to return to menu...${C.reset}`)
            continue
          }
        } else if (choice === '3') {
          const tagSuffix = await question(
            `${C.cyan}${C.bright}» Tag Name (current is v${pkg.version}):${C.reset} v`
          )
          newVersion = tagSuffix || pkg.version
        }

        // 4. Confirmation
        console.log(`\n${C.bg} CONFIRMATION ${C.reset}`)
        console.log(
          `${C.dim}Mode: ${choice === '1' ? 'Full' : choice === '2' ? 'Version' : 'Tag-Only'}${C.reset}`
        )
        console.log(
          `${C.dim}Task: pushing ${C.reset}${C.green}${C.bright}v${newVersion}${C.reset}${C.dim} to GitHub...${C.reset}`
        )

        const confirm = await question(`\n${C.yellow}${C.bright}Proceed? (y/n):${C.reset} `)
        if (confirm.toLowerCase() !== 'y') {
          console.log(`${C.dim}Aborted.${C.reset}`)
          await question(`\n${C.yellow}Press Enter to return to menu...${C.reset}`)
          continue
        }

        // 5. Execution
        console.log(`\n${C.cyan}${C.bright}Starting Release...${C.reset}\n`)

        if (choice === '1' || choice === '2') {
          pkg.version = newVersion
          writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n')
          console.log(`${C.green}✓${C.reset} package.json updated to v${newVersion}`)

          // Update Mobile files
          try {
            const mobilePkgPath = './mobile/package.json'
            const mobileAppPath = './mobile/app.json'

            const mobilePkg = JSON.parse(readFileSync(mobilePkgPath, 'utf8'))
            mobilePkg.version = newVersion
            writeFileSync(mobilePkgPath, JSON.stringify(mobilePkg, null, 2) + '\n')
            console.log(`${C.green}✓${C.reset} mobile/package.json updated to v${newVersion}`)

            const mobileApp = JSON.parse(readFileSync(mobileAppPath, 'utf8'))
            if (mobileApp.expo) {
              mobileApp.expo.version = newVersion
              writeFileSync(mobileAppPath, JSON.stringify(mobileApp, null, 2) + '\n')
              console.log(`${C.green}✓${C.reset} mobile/app.json updated to v${newVersion}`)
            }
          } catch (e) {
            console.log(`${C.yellow}⚠️  Could not update mobile files: ${e.message}${C.reset}`)
          }
        }

        if (choice === '1') {
          console.log(`${C.dim}> Staging all changes...${C.reset}`)
          execSync('git add .')
          const msg = await question(
            `${C.cyan}${C.bright}» Commit Message (default: v${newVersion}):${C.reset} `
          )
          const commitMsg = msg || `chore: release v${newVersion}`
          execSync(`git commit -m "${commitMsg}"`)
        } else if (choice === '2') {
          console.log(`${C.dim}> Staging version files...${C.reset}`)
          execSync('git add package.json mobile/package.json mobile/app.json')
          execSync(`git commit -m "chore: version bump v${newVersion}"`)
        }

        console.log(`${C.dim}> Creating tag v${newVersion}...${C.reset}`)
        execSync(`git tag -a v${newVersion} -m "v${newVersion} release"`)

        console.log(`${C.dim}> Pushing main and v${newVersion}...${C.reset}`)
        execSync(`git push origin main`)
        execSync(`git push origin v${newVersion}`)

        console.log(
          `\n${C.green}${C.bright}Release v${newVersion} Successfully Pushed! 🚀${C.reset}`
        )
        console.log(`${C.dim}Keep an eye on AutaKimi-Release for the finished build.${C.reset}\n`)

        break // Success! Exit loop.
      } catch (error) {
        console.error(`\n${C.red}${C.bright}FAILED:${C.reset} ${error.message}`)
        await question(`\n${C.yellow}Press Enter to return to menu...${C.reset}`)
      }
    }
  } finally {
    await question(`\n${C.dim}Press Enter to exit...${C.reset}`)
    rl.close()
  }
}

main()
