@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    set "key=%%a"
    if not "!key:~0,1!"=="#" if not "!key!"=="" (
      set "value=%%b"
      set "value=!value:"=!"
      set "!key!=!value!"
    )
  )
)
node dist\server.js
