import inquirer from 'inquirer';

export async function collectAnswers() {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      validate: (v) => /^[a-z0-9-]+$/.test(v) || 'Use lowercase letters, numbers, and hyphens only',
    },
    {
      type: 'list',
      name: 'frontend',
      message: 'Frontend:',
      choices: [
        { name: 'Next.js 15 (App Router)', value: 'nextjs' },
        { name: 'React SPA (Vite)', value: 'react-spa' },
        { name: 'Remix', value: 'remix' },
        { name: 'None (API only)', value: 'none' },
      ],
    },
    {
      type: 'list',
      name: 'backend',
      message: 'Backend:',
      choices: [
        { name: 'NestJS', value: 'nestjs' },
        { name: 'Express', value: 'express' },
        { name: 'Fastify', value: 'fastify' },
        { name: 'None (Next.js API routes only)', value: 'none' },
      ],
    },
    {
      type: 'list',
      name: 'database',
      message: 'Database:',
      choices: [
        { name: 'PostgreSQL', value: 'postgresql' },
        { name: 'MongoDB', value: 'mongodb' },
        { name: 'None', value: 'none' },
      ],
    },
    {
      type: 'list',
      name: 'auth',
      message: 'Authentication:',
      choices: [
        { name: 'Ory Kratos (recommended)', value: 'kratos' },
        { name: 'Custom JWT scaffold', value: 'jwt' },
        { name: 'None', value: 'none' },
      ],
    },
    {
      type: 'input',
      name: 'awsRegion',
      message: 'AWS region:',
      default: 'eu-west-2',
    },
  ]);
}

export function buildContext(answers) {
  return {
    projectName: answers.projectName,
    frontend: answers.frontend,
    backend: answers.backend,
    database: answers.database,
    auth: answers.auth,
    awsRegion: answers.awsRegion,
    isNextjs: answers.frontend === 'nextjs',
    isReactSpa: answers.frontend === 'react-spa',
    isRemix: answers.frontend === 'remix',
    isNestjs: answers.backend === 'nestjs',
    isExpress: answers.backend === 'express',
    isFastify: answers.backend === 'fastify',
    isPostgres: answers.database === 'postgresql',
    isMongo: answers.database === 'mongodb',
    isKratos: answers.auth === 'kratos',
    isJwt: answers.auth === 'jwt',
    hasAuth: answers.auth !== 'none',
    hasDatabase: answers.database !== 'none',
    hasFrontend: answers.frontend !== 'none',
    hasBackend: answers.backend !== 'none',
  };
}
