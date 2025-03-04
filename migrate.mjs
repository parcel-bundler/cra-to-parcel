#!/usr/bin/env node
import fs from 'fs';
import {spawn as _spawn} from 'child_process';
import {createRequire} from 'module';
import path from 'path';
import util from 'util';

const supportsEmoji = isUnicodeSupported();

// Fallback symbols for Windows from https://en.wikipedia.org/wiki/Code_page_437
const successEmoji = supportsEmoji ? '✨' : '√';
const errorEmoji = supportsEmoji ? '🚨' : '×';

let req = createRequire(process.cwd() + '/index');

precheck();
ejectJest();
await migratePackage();
migratePublic();
migrateSVG();
migrateCSS();
migrateMacros();
addGitignore();

console.log('');
console.log(style(['green', 'bold'], `${successEmoji} Successfully migrated from Create React App to Parcel!`));
console.log('');
console.log(`Run ${style(['green'], `${detectPackageManager()} start`)} to start the dev server.`);
console.log('Parcel may install additional plugins as needed when building your app for the first time.');
console.log('');

function precheck() {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.dependencies?.['react-scripts']) {
    error('Not a Create React App project. react-scripts was not found as a dependency.');
  }

  if (pkg.scripts?.start !== 'react-scripts start') {
    error('Unexpected "start" script. Expected "react-scripts start". Cannot complete migration.');
  }

  if (pkg.scripts?.build !== 'react-scripts build') {
    error('Unexpected "build" script. Expected "react-scripts build". Cannot complete migration.');
  }

  if (pkg.scripts?.test !== 'react-scripts test') {
    error('Unexpected "test" script. Expected "react-scripts test". Cannot complete migration.');
  }

  try {
    req('react-scripts/package.json');
  } catch (err) {
    error(`react-scripts is not installed. Run ${detectPackageManager()} first.`);
  }
}

function ejectJest() {
  log("Ejecting jest config...");
  let createJestConfig = req('react-scripts/scripts/utils/createJestConfig');
  let jestConfig = createJestConfig(
    filePath => path.posix.join('<rootDir>', filePath),
    null,
    true
  );
  delete jestConfig.setupFiles; // no need to polyfill fetch anymore
  jestConfig.moduleNameMapper['^jsx:.+\\.svg'] = '<rootDir>/config/jest/SvgComponent.js';
  fs.writeFileSync('jest.config.json', JSON.stringify(jestConfig, false, 2) + '\n');

  fs.mkdirSync('config/jest', {recursive: true});
  fs.cpSync(path.join(path.dirname(req.resolve('react-scripts/package.json')), '/config/jest'), 'config/jest', {recursive: true});
  fs.writeFileSync('config/jest/fileTransform.js', `'use strict';

const path = require('path');

// This is a custom Jest transformer turning file imports into filenames.
// http://facebook.github.io/jest/docs/en/webpack.html

module.exports = {
  process(src, filename) {
    const assetFilename = JSON.stringify(path.basename(filename));
    return \`module.exports = \${assetFilename};\`;
  },
};
`);
  fs.writeFileSync('config/jest/SvgComponent.js', `export default function SvgComponent() {
  return null;
}
`);

  let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.devDependencies ??= {};
  let reactScriptsPackage = req('react-scripts/package.json');
  for (let dep of ['jest', 'jest-watch-typeahead', 'babel-jest', 'babel-preset-react-app', 'identity-obj-proxy', 'eslint', 'eslint-config-react-app']) {
    pkg.devDependencies[dep] = reactScriptsPackage.dependencies[dep];
  }
  fs.writeFileSync('package.json', JSON.stringify(pkg, false, 2) + '\n');
}

function detectPackageManager() {
  if (fs.existsSync('package-lock.json')) {
    return 'npm';
  }
  if (fs.existsSync('yarn.lock')) {
    return 'yarn';
  }
  if (fs.existsSync('pnpm-lock.yaml')) {
    return 'pnpm';
  }
  error('No known package manager lockfile detected');
}

function spawn(cmd, args, opts) {
  console.log(style(['gray'], `$ ${cmd} ${args.join(' ')}`));
  return new Promise((resolve, reject) => {
    let p = _spawn(cmd, args, opts);
    p.on('close', (code, signal) => {
      if (code || signal) {
        reject(new Error(`${cmd} failed with exit code ${code}`));
      } else {
        console.log('');
        resolve();
      }
    });
  });
}

async function migratePackage() {
  log('Updating dependencies...');
  switch (detectPackageManager()) {
    case 'npm':
      await spawn('npm', ['rm', 'react-scripts'], {stdio: 'inherit'});
      await spawn('npm', ['install', 'parcel'], {stdio: 'inherit'});
      break;
    case 'yarn':
      await spawn('yarn', ['remove', 'react-scripts'], {stdio: 'inherit'});
      await spawn('yarn', ['add', 'parcel'], {stdio: 'inherit'});
      break;
    case 'pnpm':
      await spawn('pnpm', ['remove', 'react-scripts'], {stdio: 'inherit'});
      await spawn('pnpm', ['add', 'parcel'], {stdio: 'inherit'});
      break;
    default:
      throw new Error('Unknown package manager');
  }

  log('Updating package.json scripts...')
  let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.source = 'public/index.html';
  pkg.scripts.start = 'parcel';
  pkg.scripts.build = 'parcel build';
  pkg.scripts.test = 'jest';
  pkg.scripts.lint = 'eslint src';
  delete pkg.scripts.eject;
  fs.writeFileSync('package.json', JSON.stringify(pkg, false, 2) + '\n');
}

function migratePublic() {
  log('Updating public/index.html...');
  let html = fs.readFileSync('public/index.html', 'utf8');
  html = html.replace(/<!--\n\s*Notice the use of(.|\n)*?-->/, '');
  html = html.replace(/<!--\n\s*This HTML file is a template(.|\n)*?-->/, '');
  html = html.replace(/%PUBLIC_URL%/g, '.');
  let index = fs.existsSync('src/index.tsx') ? '../src/index.tsx' : '../src/index.js';
  html = html.replace('</body>', `  <script type="module" src="${index}"></script>\n  </body>`);
  fs.writeFileSync('public/index.html', html);
}

function migrateSVG() {
  log('Migrating SVG imports...');
  let found = false;
  walkFiles('src', file => {
    if (/\.(js|jsx|ts|tsx)$/.test(file)) {
      let contents = fs.readFileSync(file, 'utf8');
      let replaced = false;
      contents = contents.replace(/import\s*(?:(.*?),)?\s*\{[\s\n]*ReactComponent(?:\s+as\s+([^\s,]*?))?[\s\n]*\}[\s\n]+from\s+(['"].*?['"]);?\n/g, (_, defaultName, componentName, specifier) => {
        let res = '';
        if (defaultName) {
          res += `import ${defaultName} from ${specifier};\n`;
        }
        let s = specifier[0] + 'jsx:' + specifier.slice(1);
        res += `import ${componentName || 'ReactComponent'} from ${s};\n`;
        replaced = true;
        return res;
      });
      if (replaced) {
        found = true;
        fs.writeFileSync(file, contents);
      }
    }
  });

  if (found) {
    console.log('  Detected SVG component imports. Added @parcel/transformer-svg-react to .parcelrc');
    fs.writeFileSync('.parcelrc', JSON.stringify({
      extends: '@parcel/config-default',
      transformers: {
        'jsx:*.svg': ['...', '@parcel/transformer-svg-react'],
        // https://github.com/parcel-bundler/parcel/issues/7587
        'jsx:*': ["..."]
      }
    }, false, 2) + '\n');
  }
}

function migrateCSS() {
  log('Migrating CSS...');
  let found = false;
  walkFiles('src', file => {
    if (file.endsWith('.css')) {
      let contents = fs.readFileSync(file, 'utf8');
      if (contents.includes('@import-normalize')) {
        found = true;
        return false;
      }
    }
  });

  let postcssrc = {plugins: []};
  try {
    postcssrc = JSON.parse(fs.readFileSync('.postcssrc', 'utf8'));
    postcssrc.plugins ??= [];
  } catch {}

  let needsWrite = false;
  if (found) {
    console.log('  Detected @import-normalize. Added postcss-normalize to .postcssrc');
    postcssrc.plugins.push('postcss-normalize');
    needsWrite = true;
  }

  if (fs.existsSync('tailwind.config.js')) {
    console.log('  Detected tailwind.config.js. Added to .postcssrc');
    postcssrc.plugins.push('tailwindcss');
    needsWrite = true;

    let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.devDependencies ??= {};
    pkg.devDependencies.tailwindcss = '^3.0.2';
    fs.writeFileSync('package.json', JSON.stringify(pkg, false, 2) + '\n');
  }

  if (needsWrite) {
    fs.writeFileSync('.postcssrc', JSON.stringify(postcssrc, false, 2) + '\n');
  }
}

function migrateMacros() {
  log('Migrating JS...');
  let found = false;
  walkFiles('src', file => {
    if (/\.(js|jsx|ts|tsx)$/.test(file)) {
      let contents = fs.readFileSync(file, 'utf8');
      if (/import(?:.|\n)*?from\s+['"].*?\.macro['"]/.test(contents)) {
        found = true;
        return false;
      }
    }
  });

  if (found) {
    console.log('  Detected babel macros. Added babel.config.json');
    fs.writeFileSync('babel.config.json', JSON.stringify({
      plugins: ['babel-plugin-macros']
    }, false, 2) + '\n');
  }
}

function addGitignore() {
  log('Adding Parcel files to .gitignore');
  let gitignore = fs.readFileSync('.gitignore', 'utf8');
  gitignore += '\n.parcel-cache\ndist';
  fs.writeFileSync('.gitignore', gitignore);
}

function walkFiles(f, cb) {
  for (let file of fs.readdirSync(f, {withFileTypes: true})) {
    let fullPath = path.join(f, file.name);
    if (file.isDirectory()) {
      if (walkFiles(fullPath, cb) === false) {
        return false;
      }
    } else if (file.isFile()) {
      if (cb(fullPath) === false) {
        return false;
      }
    }
  }
}

function log(message) {
  console.log(style(['cyan'], message));
}

function error(message) {
  console.error(style(['red'], errorEmoji + ' ' + message));
  process.exit(1);
}

function style(format, text) {
  if (util.styleText) {
    return util.styleText(format, text);
  } else {
    return text;
  }
}

// From https://github.com/sindresorhus/is-unicode-supported/blob/8f123916d5c25a87c4f966dcc248b7ca5df2b4ca/index.js
// This package is ESM-only so it has to be vendored
function isUnicodeSupported() {
  if (process.platform !== 'win32') {
    return process.env.TERM !== 'linux'; // Linux console (kernel)
  }

  return (
    Boolean(process.env.CI) ||
    Boolean(process.env.WT_SESSION) || // Windows Terminal
    process.env.ConEmuTask === '{cmd::Cmder}' || // ConEmu and cmder
    process.env.TERM_PROGRAM === 'vscode' ||
    process.env.TERM === 'xterm-256color' ||
    process.env.TERM === 'alacritty'
  );
}
