#!/usr/bin/env node
import { Command } from 'commander';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { collectAnswers, buildContext } from './prompts.js';
import { generate } from './generator.js';

const program = new Command();

program
  .name('create-shipfast')
  .description('Scaffold a production-ready client web application')
  .version('0.1.0')
  .action(async () => {
    const answers = await collectAnswers();
    const context = buildContext(answers);
    const outputDir = join(process.cwd(), answers.projectName);
    await mkdir(outputDir, { recursive: true });
    await generate(answers, context, outputDir);
  });

program.parse();
