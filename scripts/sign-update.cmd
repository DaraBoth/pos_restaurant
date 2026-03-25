@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0.."

if "%~1"=="" (
  echo Usage: scripts\sign-update.cmd ^<artifact-path^>
  echo Example: scripts\sign-update.cmd src-tauri\target\release\bundle\msi\DineOS_0.1.1_x64_en-US.msi
  exit /b 1
)

if not exist "src-tauri\signing.key" (
  echo Missing signing key: src-tauri\signing.key
  exit /b 1
)

if not exist "%~1" (
  echo Missing artifact: %~1
  exit /b 1
)

rem Clear conflicting signer variables if present in current shell
set TAURI_SIGNING_PRIVATE_KEY=
set TAURI_SIGNING_PRIVATE_KEY_PATH=
set TAURI_SIGNING_PRIVATE_KEY_PASSWORD=

npx -y @tauri-apps/cli@latest signer sign -f src-tauri\signing.key -p both123 "%~1"
