@echo off
REM 로그인 시 작업 스케줄러가 실행하는 개발서버 자동 시작 스크립트.
REM Tailscale HTTPS로 폰에서 바로 볼 수 있게(vite.config.ts 참고), 재부팅 후에도
REM 수동으로 npm run dev를 다시 칠 필요가 없도록 만든 것.
cd /d D:\project\wayknit
"C:\Program Files\nodejs\npm.cmd" run dev >> "%~dp0..\dev-server.log" 2>&1
