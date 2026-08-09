@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

set JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.12.8-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%

cd /d C:\Users\32066\chat-assistant
node scripts\build_apk.js
