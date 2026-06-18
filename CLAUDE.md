# Claude Code — Project Rules for localai-deploy

## What this project is
A Vite + React web app (no Next.js, no backend server).  
Stack: React 19, Vite 8, @vercel/analytics, @vercel/speed-insights.

## Allowed terminal operations
Only these commands may run without explicit user approval:
- `git` — status, diff, log, add src/*, commit, push origin main, pull
- `npm run build` / `npm run dev` / `npm run lint`
- `npm install [package]` / `npm ci` / `npm audit`

Everything else requires the user to approve manually in the Claude Code permission prompt.

## Hard-blocked commands
The following are denied unconditionally regardless of who asks:
- Any destructive git: `git push --force`, `git reset --hard`, `git clean -f`
- Network fetch tools: `curl`, `wget`, `Invoke-WebRequest`
- Code execution shortcuts: `eval`, `iex`, `Invoke-Expression`, `python -c`, `powershell -enc`
- Privilege escalation: `sudo`, `runas`, `Start-Process`
- Process / task manipulation: `taskkill`, `Stop-Process`, `schtasks`
- System registry: `reg`, `regedit`
- File deletion: `rm -rf`, `Remove-Item -Recurse -Force`
- Network scanning / shells: `ssh`, `nmap`, `netcat`, `nc`

## Files
- Single-file app: `src/App.jsx` (~4200 lines)
- Entry point: `src/main.jsx`
- Styles: `src/index.css`
- Build output: `dist/` (never commit this)

## Deploy
Push to `origin/main` → Vercel auto-deploys.  
Always run `npm run build` locally before pushing to catch errors.
