@echo off
setlocal
cd /d "%~dp0"
echo Atualizando os dados das telas a partir dos Parquets da pasta data...
py "%~dp0scripts\atualizar_dados_local.py"
if errorlevel 1 (
  echo ERRO ao atualizar. Confira os Parquets e a instalacao de Python, duckdb, pandas e pyarrow.
  if /I not "%~1"=="--sem-pausa" pause
  exit /b 1
)
echo OK. Recarregue a pagina com Ctrl+F5.
if /I not "%~1"=="--sem-pausa" pause
exit /b 0
