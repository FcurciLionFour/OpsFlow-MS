#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = 'true';
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readFileSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function updateEnvPort(content, port) {
  if (!content) return content;
  if (content.includes('\nPORT=')) {
    return content.replace(/(^|\n)PORT=\d+/m, `$1PORT=${port}`);
  }
  return `PORT=${port}\n${content}`;
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const rawName = args.name;
  const description = args.description ?? '';
  const port = Number(args.port ?? 3000);

  if (!rawName) {
    console.error(
      'Missing --name. Example: node scripts/new-project.js --name "Client API" --port 3001',
    );
    process.exit(1);
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('--port must be a valid integer between 1 and 65535.');
    process.exit(1);
  }

  const packageJsonPath = path.join(root, 'package.json');
  const readmePath = path.join(root, 'README.md');
  const envExamplePath = path.join(root, '.env.example');
  const envPath = path.join(root, '.env');

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const packageName = slugify(rawName);

  packageJson.name = packageName;
  packageJson.description = description || `${rawName} backend service`;
  writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  const readme = readFileSafe(readmePath);
  if (readme) {
    const updatedReadme = readme
      .replace(/^# .+$/m, `# ${packageName}`)
      .replace(/backend-nestjs-boilerplate/g, packageName);
    writeFile(readmePath, updatedReadme);
  }

  const envExample = readFileSafe(envExamplePath);
  if (envExample) {
    writeFile(envExamplePath, updateEnvPort(envExample, port));
  }

  const env = readFileSafe(envPath);
  if (env) {
    writeFile(envPath, updateEnvPort(env, port));
  }

  console.log('Project bootstrap completed.');
  console.log(`- name: ${packageName}`);
  console.log(`- description: ${packageJson.description}`);
  console.log(`- port: ${port}`);
  console.log('Next steps: npm ci && npm run db:migrate:dev && npm run start:dev');
}

run();
