import { spawnSync } from 'node:child_process';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed${output ? `:\n${output}` : ''}`);
  }

  return (result.stdout || '').trim();
}

function runGit(args) {
  return run('git', args);
}

runGit(['rev-parse', '--is-inside-work-tree']);

const branch = runGit(['branch', '--show-current']);
if (!branch) {
  throw new Error('Detached HEAD detected. Check out main before deploying.');
}

console.log(`Current branch: ${branch}`);

runGit(['fetch', 'origin', branch]);

const localHead = runGit(['rev-parse', 'HEAD']);
const remoteRef = `origin/${branch}`;
const remoteHead = runGit(['rev-parse', remoteRef]);

console.log(`Local HEAD:  ${localHead}`);
console.log(`Remote HEAD: ${remoteHead}`);

if (localHead !== remoteHead) {
  const leftRight = runGit(['rev-list', '--left-right', '--count', `HEAD...${remoteRef}`]);
  const [ahead = '0', behind = '0'] = leftRight.split(/\s+/);

  throw new Error([
    `Local ${branch} is not in sync with ${remoteRef}.`,
    `Ahead: ${ahead}; behind: ${behind}.`,
    'Run git status --short, resolve local changes if needed, then run git pull --rebase before deploying.',
  ].join('\n'));
}

console.log('Repository sync check passed. Local HEAD matches origin branch.');
