import { spawnSync } from 'node:child_process';

const node = process.execPath;

const steps = [
  {
    label: 'TypeScript typecheck',
    command: node,
    args: ['node_modules/typescript/bin/tsc', '--noEmit'],
  },
  {
    label: 'Vitest test suite',
    command: node,
    args: ['node_modules/vitest/vitest.mjs', 'run'],
  },
  {
    label: 'Vite production build',
    command: node,
    args: ['node_modules/vite/bin/vite.js', 'build'],
  },
  {
    label: 'Dist JS chunk size check',
    command: node,
    args: ['scripts/check-dist-size.mjs'],
  },
];

for (const step of steps) {
  console.log(`\n[predeploy] ${step.label}`);
  console.log(`[predeploy] ${step.command} ${step.args.join(' ')}`);

  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(`\n[predeploy] Failed to start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n[predeploy] Failed: ${step.label}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n[predeploy] All checks passed.');
