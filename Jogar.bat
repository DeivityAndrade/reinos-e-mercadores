@echo off
title Reinos ^& Mercadores
cd /d "%~dp0"
echo Iniciando Reinos ^& Mercadores...
echo (deixe esta janela aberta enquanto joga; feche-a para encerrar)
start "" "http://localhost:8080/"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8080
