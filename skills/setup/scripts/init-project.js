/**
 * Project scaffolding script for Node/TypeScript projects.
 *
 * Usage:
 *   node init-project.js [--name=<project-name>] [--framework=<vite|nextjs|express|fastify|none>]
 *
 * Creates a directory structure, git repo, and package.json with appropriate deps.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

// ---------------------------------------------------------------------------
// Flag parsing
// ---------------------------------------------------------------------------

const VALID_FRAMEWORKS = ['vite', 'nextjs', 'express', 'fastify', 'none'];

function parseArgs(argv) {
  const flags = { name: null, framework: 'none', skipInstall: false, inPlace: false };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--name=')) flags.name = arg.slice('--name='.length);
    else if (arg.startsWith('--framework=')) flags.framework = arg.slice('--framework='.length);
    else if (arg === '--skip-install') flags.skipInstall = true;
    else if (arg === '--in-place') flags.inPlace = true;
  }
  if (!VALID_FRAMEWORKS.includes(flags.framework)) {
    console.error('Unknown framework "' + flags.framework + '". Must be one of: ' + VALID_FRAMEWORKS.join(', '));
    process.exit(1);
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Dependency maps
// ---------------------------------------------------------------------------

const FRAMEWORK_DEPS = {
  none:     { dependencies: {}, devDependencies: {} },
  express:  { dependencies: { express: '*' }, devDependencies: { '@types/express': '*' } },
  fastify:  { dependencies: { fastify: '*' }, devDependencies: {} },
  vite:     {
    dependencies: { vite: '*', '@vitejs/plugin-react': '*', react: '*', 'react-dom': '*' },
    devDependencies: { '@types/react': '*' },
  },
  nextjs:   {
    dependencies: { next: '*', react: '*', 'react-dom': '*' },
    devDependencies: { '@types/react': '*' },
  },
};

const TS_DEV_DEPS = { typescript: '*', '@types/node': '*' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd, args, cwd) {
  childProcess.execFileSync(cmd, args, { cwd: cwd, stdio: 'ignore' });
}

function mkdirs(base, dirs) {
  for (const d of dirs) {
    fs.mkdirSync(path.join(base, d), { recursive: true });
  }
}

function buildPackageJson(name, framework) {
  const frameworkDeps = FRAMEWORK_DEPS[framework];
  return {
    name: name,
    version: '1.0.0',
    dependencies: Object.assign({}, frameworkDeps.dependencies),
    devDependencies: Object.assign({}, TS_DEV_DEPS, frameworkDeps.devDependencies),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const flags = parseArgs(process.argv);

  // Resolve working directory
  let projectDir = process.cwd();
  if (flags.name && !flags.inPlace) {
    projectDir = path.join(process.cwd(), flags.name);
    fs.mkdirSync(projectDir, { recursive: true });
  }

  const projectName = flags.name || path.basename(projectDir);

  // Git init if needed
  if (!fs.existsSync(path.join(projectDir, '.git'))) {
    run('git', ['init'], projectDir);
  }

  // Create package.json only if absent
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    const pkg = buildPackageJson(projectName, flags.framework);
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  // Scaffold standard directories
  mkdirs(projectDir, ['src', 'tests', 'scripts', 'docs']);

  // Install dependencies
  if (!flags.skipInstall) {
    run('npm', ['install'], projectDir);
  }
}

main();
