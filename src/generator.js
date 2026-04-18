import { readdir, readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const TEMPLATES_DIR = join(__dirname, '..', 'templates');

export async function processTemplateDir(srcDir, destDir, context) {
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destName = entry.name.endsWith('.hbs')
      ? entry.name.slice(0, -4)
      : entry.name;
    const destPath = join(destDir, destName);

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await processTemplateDir(srcPath, destPath, context);
    } else if (entry.name.endsWith('.hbs')) {
      const raw = await readFile(srcPath, 'utf-8');
      const compiled = Handlebars.compile(raw)(context);
      if (!compiled.trim()) continue;
      await mkdir(dirname(destPath), { recursive: true });
      await writeFile(destPath, compiled, 'utf-8');
    } else {
      await mkdir(dirname(destPath), { recursive: true });
      await copyFile(srcPath, destPath);
    }
  }
}

export async function generate(answers, context, outputDir) {
  if (answers.frontend !== 'none') {
    await processTemplateDir(
      join(TEMPLATES_DIR, 'frontend', answers.frontend),
      join(outputDir, 'frontend'),
      context,
    );
  }

  if (answers.backend !== 'none') {
    await processTemplateDir(
      join(TEMPLATES_DIR, 'backend', answers.backend),
      join(outputDir, 'backend'),
      context,
    );
  }

  await processTemplateDir(
    join(TEMPLATES_DIR, 'shared'),
    outputDir,
    context,
  );
}
