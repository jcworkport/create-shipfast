#!/usr/bin/env node
import * as p from '@clack/prompts';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { collectAnswers, buildContext } from './prompts.js';
import { generate } from './generator.js';

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

const answers = await collectAnswers();
const context = buildContext(answers);
const outputDir = join(process.cwd(), answers.projectName);

await mkdir(outputDir, { recursive: true });

const s = p.spinner();
s.start(`Scaffolding ${answers.projectName}`);
await generate(answers, context, outputDir);
s.stop(`Scaffolded ${answers.projectName}`);

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
