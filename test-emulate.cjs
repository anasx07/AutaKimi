const path = require('path');
const fs = require('fs');

// Emulate tryReadLocalFile
function getAllowedDirectories() {
  const dirs = [
    path.join(process.cwd(), 'autakimi-extensions'),
    path.resolve(process.cwd(), '../../autakimi-extensions'),
    path.join(process.cwd(), 'resources')
  ];
  return dirs;
}

function resolveTargetPath(targetUrl) {
  if (targetUrl.startsWith('file:///')) {
    return new URL(targetUrl).pathname;
  }
  return path.resolve(targetUrl);
}

function isPathAllowed(resolvedPath, allowedDirs) {
  const isWin = process.platform === 'win32';
  return allowedDirs.some((dir) => {
    const normalizedDir = path.resolve(dir);
    const checkPath = isWin ? resolvedPath.toLowerCase() : resolvedPath;
    const checkDir = isWin ? normalizedDir.toLowerCase() : normalizedDir;
    return checkPath === checkDir || checkPath.startsWith(checkDir + path.sep);
  });
}

function tryReadLocalFile(urlStr) {
  const isGithubIntercept = false;
  
  if (!isGithubIntercept && (urlStr.startsWith('http://') || urlStr.startsWith('https://'))) {
    return "null (starts with http)";
  }

  const allowedDirs = getAllowedDirectories();
  console.log("Allowed dirs:", allowedDirs);

  if (allowedDirs.length === 0) {
    return "null (no allowed dirs)";
  }

  let resolved = path.resolve(resolveTargetPath(urlStr));
  console.log("Resolved:", resolved);

  if (!isPathAllowed(resolved, allowedDirs)) {
    return "Error: Access denied";
  }

  if (!fs.existsSync(resolved)) {
    return "null (does not exist)";
  }

  if (fs.statSync(resolved).isDirectory()) {
    return "null (is directory)";
  }

  return "Success!";
}

console.log(tryReadLocalFile('D:\\DEV\\Apps\\AutaKimi\\autakimi-extensions/templates.json'));
