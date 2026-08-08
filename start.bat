@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 仰止
cd /d "%~dp0"

:: 获取本机 IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "172." ^| findstr /v "169."') do (
    set IP=%%a
    set IP=!IP:~1!
    goto :got_ip
)
:got_ip

echo.
echo ╔══════════════════════════════════════╗
echo ║          💬 仰止                    ║
echo ║    高山仰止，景行行止               ║
echo ╚══════════════════════════════════════╝
echo.
echo 📱 手机安装步骤：
echo    1. 确保手机和电脑在同一 WiFi
echo    2. 手机浏览器打开下面地址
echo    3. Chrome 菜单 → "添加到主屏幕"
echo.

where npx >nul 2>nul
if %errorlevel%==0 (
    echo ──────────────────────────────────
    echo  🌐 PC 访问:   http://localhost:3000
    if not "!IP!"=="" echo  📱 手机访问: http://!IP!:3000
    echo ──────────────────────────────────
    echo.
    start http://localhost:3000
    npx serve . -p 3000 --listen --no-clipboard
    goto :end
)

where python3 >nul 2>nul
if %errorlevel%==0 (
    echo 📱 手机访问: http://!IP!:8080
    start http://localhost:8080
    python3 -m http.server 8080 --bind 0.0.0.0
    goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
    echo 📱 手机访问: http://!IP!:8080
    start http://localhost:8080
    python -m http.server 8080 --bind 0.0.0.0
    goto :end
)

echo ❌ 请先安装 Node.js ^(https://nodejs.org^) 或 Python
pause
:end
