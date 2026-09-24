@echo off
setlocal
cd /d "%~dp0"
echo Atualizando Parquets locais para uso direto no HTML...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$b=[Convert]::ToBase64String([IO.File]::ReadAllBytes('data\indice_zootecnico_base_dinamica_tratado.parquet')); [IO.File]::WriteAllText('data\base_dinamica_embedded.js','window.PARQUET_BASE_DINAMICA_B64=\"'+$b+'\";',[Text.UTF8Encoding]::new($false)); $l=[Convert]::ToBase64String([IO.File]::ReadAllBytes('data\indice_zootecnico_mortalidade_peso_lotes_abertos_tratado.parquet')); [IO.File]::WriteAllText('data\lotes_abertos_embedded.js','window.PARQUET_LOTES_ABERTOS_B64=\"'+$l+'\";',[Text.UTF8Encoding]::new($false))"
if errorlevel 1 (
  echo ERRO ao preparar os dados locais.
  pause
  exit /b 1
)
echo OK. Dados locais atualizados sem Python e sem API.
echo Abra index.html normalmente.
pause
