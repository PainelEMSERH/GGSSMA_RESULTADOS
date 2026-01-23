@echo off
cd /d "%~dp0"
echo Adicionando arquivos modificados...
git add "app/(app)/entregas/page.tsx"
git add "app/api/entregas/deliver/route.ts"
echo.
echo Fazendo commit...
git commit -m "feat: adiciona entrega em massa de EPIs e corrige funcionalidade de dar baixa"
echo.
echo Fazendo push para o GitHub...
git push origin main
echo.
echo Pronto! As mudanças foram enviadas para o GitHub.
pause
