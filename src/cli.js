#!/usr/bin/env node
import * as p from '@clack/prompts';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { collectAnswers, buildContext } from './prompts.js';
import { generate } from './generator.js';
import { fetchImageVersions } from './image-versions.js';

const BANNER = `
   _____ __    _                        __
  / ___// /_  (_)___  ____  ____ ______/ /_
  \\__ \\/ __ \\/ / __ \\/ __ \\/ __ \`/ ___/ __/
 ___/ / / / / / /_/ / /_/ / /_/ (__  ) /_
/____/_/ /_/_/ .___/\\____/\\__,_/____/\\__/
            /_/
`;

console.log(BANNER);
p.intro('scaffold a production-ready app');

const s = p.spinner();
s.start('Checking latest image versions...');
const { versions, failed } = await fetchImageVersions();
s.stop('Image versions resolved.');

if (failed.length > 0) {
  p.note(
    `Could not fetch latest versions for: ${failed.join(', ')}\nFalling back to known-good defaults. Verify manually before deploying.`,
    'Warning',
  );
}

const answers = await collectAnswers(versions);
const context = buildContext(answers, versions);
const outputDir = join(process.cwd(), answers.projectName);

await mkdir(outputDir, { recursive: true });

const gen = p.spinner();
gen.start(`Scaffolding ${answers.projectName}`);
await generate(answers, context, outputDir);
gen.stop(`Scaffolded ${answers.projectName}`);

const secrets = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'ECR_REGISTRY',
];
if (answers.database === 'postgresql') secrets.push('DATABASE_URL');
if (answers.database === 'mongodb') secrets.push('MONGODB_URI');
if (answers.auth === 'kratos') secrets.push('KRATOS_URL');

p.note(
  [
    `cd ${answers.projectName}`,
    `npm run dev:build   # first run`,
    `npm run dev         # subsequent runs`,
    ``,
    `Deploy:  npm run deploy`,
    ``,
    `GitHub secrets to add:`,
    ...secrets.map((secret) => `  ${secret}`),
  ].join('\n'),
  'Next steps',
);

p.outro('Happy shipping!');
