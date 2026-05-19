const { execSync, spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Helper to find emulator command
function getEmulatorCommand() {
  // Try direct PATH execution first
  try {
    execSync('emulator -version', { stdio: 'ignore' });
    return 'emulator';
  } catch (e) {
    // Fallbacks
    const localAppData = process.env.LOCALAPPDATA || '';
    const androidHome = process.env.ANDROID_HOME || '';
    
    const paths = [
      path.join(androidHome, 'emulator', 'emulator.exe'),
      path.join(localAppData, 'Android', 'Sdk', 'emulator', 'emulator.exe'),
      path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Android', 'Sdk', 'emulator', 'emulator.exe')
    ];

    for (const p of paths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
  }
  return null;
}

const emulatorCmd = getEmulatorCommand();

if (!emulatorCmd) {
  console.error('\x1b[31mError: Could not locate Android emulator binary.\x1b[0m');
  console.error('Please make sure Android SDK is installed and ANDROID_HOME or PATH is configured.');
  process.exit(1);
}

try {
  console.log('\x1b[36mFetching available Android Virtual Devices (AVDs)...\x1b[0m');
  const output = execSync(`"${emulatorCmd}" -list-avds`, { encoding: 'utf8' });
  const avds = output.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  if (avds.length === 0) {
    console.warn('\x1b[33mNo Android Virtual Devices (AVDs) found.\x1b[0m');
    console.warn('Use Android Studio Device Manager to create an emulator first.');
    process.exit(0);
  }

  console.log('\n\x1b[32mAvailable Android Emulators:\x1b[0m');
  avds.forEach((avd, index) => {
    console.log(`  \x1b[1m${index + 1})\x1b[0m ${avd}`);
  });
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askChoice = () => {
    rl.question(`Select an emulator to start (1-${avds.length}) or type 'q' to quit: `, (answer) => {
      const cleanAnswer = answer.trim().toLowerCase();
      if (cleanAnswer === 'q' || cleanAnswer === 'quit') {
        console.log('Exiting.');
        rl.close();
        process.exit(0);
      }

      const choice = parseInt(cleanAnswer, 10);
      if (isNaN(choice) || choice < 1 || choice > avds.length) {
        console.log(`\x1b[31mInvalid choice. Please enter a number between 1 and ${avds.length}.\x1b[0m`);
        askChoice();
      } else {
        const selectedAvd = avds[choice - 1];
        console.log(`\n\x1b[36mStarting ${selectedAvd} in the background...\x1b[0m`);

        // Start emulator as a detached background process
        const child = spawn(emulatorCmd, ['-avd', selectedAvd], {
          detached: true,
          stdio: 'ignore'
        });

        child.unref();
        console.log(`\x1b[32mProcess detached successfully. The emulator is booting up.\x1b[0m`);
        rl.close();
        process.exit(0);
      }
    });
  };

  askChoice();
} catch (error) {
  console.error('\x1b[31mAn error occurred while listing or launching the emulator:\x1b[0m', error.message || error);
  process.exit(1);
}
