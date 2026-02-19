import fs from 'fs';
import path from 'path';

const root = path.resolve(process.cwd());

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function toKebab(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toPascal(value) {
  return value
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(filePath, content) {
  if (fs.existsSync(filePath)) {
    throw new Error(`File already exists: ${filePath}`);
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawName = args.name;

  if (!rawName) {
    console.error(
      'Missing --name. Example: npm run feature:new -- --name invoices',
    );
    process.exit(1);
  }

  const feature = toKebab(rawName);
  const featurePascal = toPascal(feature);

  const srcDir = path.join(root, 'src', feature);
  const dtoDir = path.join(srcDir, 'dto');
  const testDir = path.join(root, 'test');

  ensureDir(srcDir);
  ensureDir(dtoDir);
  ensureDir(testDir);

  writeFile(
    path.join(srcDir, `${feature}.module.ts`),
    `import { Module } from '@nestjs/common';
import { ${featurePascal}Controller } from './${feature}.controller';
import { ${featurePascal}Service } from './${feature}.service';

@Module({
  controllers: [${featurePascal}Controller],
  providers: [${featurePascal}Service],
})
export class ${featurePascal}Module {}
`,
  );

  writeFile(
    path.join(srcDir, `${feature}.service.ts`),
    `import { Injectable } from '@nestjs/common';

@Injectable()
export class ${featurePascal}Service {
  findAll() {
    return [];
  }
}
`,
  );

  writeFile(
    path.join(srcDir, `${feature}.controller.ts`),
    `import { Controller, Get } from '@nestjs/common';
import { ${featurePascal}Service } from './${feature}.service';

@Controller('${feature}')
export class ${featurePascal}Controller {
  constructor(private readonly ${feature}Service: ${featurePascal}Service) {}

  @Get()
  findAll() {
    return this.${feature}Service.findAll();
  }
}
`,
  );

  writeFile(
    path.join(dtoDir, `create-${feature}.dto.ts`),
    `export class Create${featurePascal}Dto {}
`,
  );

  writeFile(
    path.join(dtoDir, `update-${feature}.dto.ts`),
    `export class Update${featurePascal}Dto {}
`,
  );

  writeFile(
    path.join(srcDir, `${feature}.service.spec.ts`),
    `import { Test } from '@nestjs/testing';
import { ${featurePascal}Service } from './${feature}.service';

describe('${featurePascal}Service', () => {
  it('should be defined', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [${featurePascal}Service],
    }).compile();

    expect(moduleRef.get(${featurePascal}Service)).toBeDefined();
  });
});
`,
  );

  writeFile(
    path.join(srcDir, `${feature}.controller.spec.ts`),
    `import { Test } from '@nestjs/testing';
import { ${featurePascal}Controller } from './${feature}.controller';
import { ${featurePascal}Service } from './${feature}.service';

describe('${featurePascal}Controller', () => {
  it('should be defined', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [${featurePascal}Controller],
      providers: [${featurePascal}Service],
    }).compile();

    expect(moduleRef.get(${featurePascal}Controller)).toBeDefined();
  });
});
`,
  );

  writeFile(
    path.join(testDir, `${feature}.e2e-spec.ts`),
    `import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

@Controller('${feature}')
class ${featurePascal}E2eController {
  @Get()
  findAll() {
    return [];
  }
}

@Module({
  controllers: [${featurePascal}E2eController],
})
class ${featurePascal}E2eModule {}

describe('${featurePascal} (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [${featurePascal}E2eModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/${feature} (GET)', () => {
    return request(app.getHttpServer()).get('/${feature}').expect(200).expect([]);
  });
});
`,
  );

  console.log(`Feature scaffold created: ${feature}`);
}

main();
