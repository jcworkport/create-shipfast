import * as p from '@clack/prompts';

function cancelOnExit(value) {
  if (p.isCancel(value)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }
  return value;
}

export async function collectAnswers(versions) {
  const projectName = cancelOnExit(await p.text({
    message: 'Project name:',
    validate: (v) => /^[a-z0-9-]+$/.test(v)
      ? undefined
      : 'Use lowercase letters, numbers, and hyphens only',
  }));

  const frontend = cancelOnExit(await p.select({
    message: 'Frontend:',
    options: [
      { value: 'nextjs', label: 'Next.js 15 (App Router)' },
      { value: 'none',   label: 'None (API only)' },
    ],
  }));

  const backend = cancelOnExit(await p.select({
    message: 'Backend:',
    options: [
      { value: 'nestjs', label: 'NestJS' },
      { value: 'none',   label: 'None (Next.js API routes only)' },
    ],
  }));

  const database = cancelOnExit(await p.select({
    message: 'Database:',
    options: [
      { value: 'postgresql', label: `PostgreSQL  (${versions.postgres.tag} · ${versions.postgres.date})` },
      { value: 'mongodb',    label: `MongoDB     (${versions.mongo.tag} · ${versions.mongo.date})` },
      { value: 'none',       label: 'None' },
    ],
  }));

  const auth = cancelOnExit(await p.select({
    message: 'Authentication:',
    options: [
      { value: 'kratos', label: `Ory Kratos  (${versions.kratos.tag} · ${versions.kratos.date})` },
      { value: 'jwt',    label: 'Custom JWT scaffold' },
      { value: 'none',   label: 'None' },
    ],
  }));

  const awsRegion = cancelOnExit(await p.text({
    message: 'AWS region:',
    initialValue: 'eu-west-2',
  }));

  return { projectName, frontend, backend, database, auth, awsRegion };
}

export function buildContext(answers, versions) {
  return {
    projectName: answers.projectName,
    frontend: answers.frontend,
    backend: answers.backend,
    database: answers.database,
    auth: answers.auth,
    awsRegion: answers.awsRegion,
    isNextjs:   answers.frontend === 'nextjs',
    isReactSpa: answers.frontend === 'react-spa',
    isRemix:    answers.frontend === 'remix',
    isNestjs:   answers.backend === 'nestjs',
    isExpress:  answers.backend === 'express',
    isFastify:  answers.backend === 'fastify',
    isPostgres: answers.database === 'postgresql',
    isMongo:    answers.database === 'mongodb',
    isKratos:   answers.auth === 'kratos',
    isJwt:      answers.auth === 'jwt',
    hasAuth:     answers.auth !== 'none',
    hasDatabase: answers.database !== 'none',
    hasFrontend: answers.frontend !== 'none',
    hasBackend:  answers.backend !== 'none',
    backendHasDeps: answers.database !== 'none' || answers.auth === 'kratos',
    hasVolumes:     answers.database !== 'none' || answers.auth === 'kratos',
    postgresImage: versions.postgres.tag,
    mongoImage:    versions.mongo.tag,
    kratosImage:   versions.kratos.tag,
    mailpitImage:  versions.mailpit.tag,
  };
}
