#!/usr/bin/env node
/**
 * `npm run deploy` 진입점 — OS에 맞는 배포 스크립트로 넘긴다.
 *
 * 왜 필요한가 (HANDOFF §12):
 *   package.json 이 `bash scripts/deploy-prod.sh` 를 직접 부르면, PowerShell 에서
 *   실행할 때 `bash` 가 Git Bash 가 아니라 WSL(C:\Windows\system32\bash.exe)로
 *   잡힌다. 그러면 스크립트 전체가 리눅스 안에서 돌면서 프로젝트를 /mnt/d/... 로
 *   보는데 node_modules 는 Windows 네이티브라 rollup 이 죽는다.
 *   그래서 Windows 면 PowerShell 판을 부른다 — 어느 셸에서 쳐도 결과가 같다.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const message = args.find((a) => a !== '--dry-run') ?? '';

let cmd, cmdArgs;
if (process.platform === 'win32') {
  cmdArgs = [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', join(here, 'deploy-prod.ps1'),
  ];
  if (message) cmdArgs.push('-Message', message);
  if (dryRun) cmdArgs.push('-DryRun');
  cmd = 'powershell.exe';
} else {
  cmdArgs = [join(here, 'deploy-prod.sh')];
  if (dryRun) cmdArgs.push('--dry-run');
  if (message) cmdArgs.push(message);
  cmd = 'bash';
}

const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit' });
if (r.error) {
  console.error(`✗ ${cmd} 를 실행하지 못했다: ${r.error.message}`);
  process.exit(1);
}
process.exit(r.status ?? 1);
