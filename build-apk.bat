@echo off
chcp 65001 >nul
title 仰止 - APK 打包
cd /d "%~dp0"

echo.
echo ╔══════════════════════════════════════╗
echo ║   📦 仰止 APK 打包工具              ║
echo ╚══════════════════════════════════════╝
echo.

:: 检查 Java
where java >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到 Java JDK，APK 打包需要 JDK 17+
    echo.
    echo 📥 下载 JDK: https://adoptium.net/download
    echo    选择 Windows x64 JDK 17 或 21
    echo    安装后重新运行此脚本
    echo.
    echo ══════════════════════════════════════
    echo 💡 无需 JDK 的替代方案：
    echo.
    echo 方案A - 在线打包（推荐）：
    echo   1. 先将项目部署到公网
    echo      - GitHub Pages: 免费
    echo      - EdgeOne Pages: 国内快
    echo   2. 打开 https://pwabuilder.com
    echo   3. 输入你的网址 → 自动生成 APK
    echo.
    echo 方案B - 手机直接安装 PWA：
    echo   双击 start.bat → 手机浏览器打开
    echo   → Chrome菜单 → "添加到主屏幕"
    echo.
    pause
    goto :end
)

echo ✅ Java 已就绪
echo.

:: 检查并安装 bubblewrap
where bubblewrap >nul 2>nul
if %errorlevel% neq 0 (
    echo 📥 安装 Bubblewrap...
    call npm install -g @bubblewrap/cli
)

echo 🔨 生成 APK 项目...
call bubblewrap init --manifest="%cd%\manifest.json"

echo.
echo ✅ APK 项目已生成
echo 📂 位置: %cd%\app-release-signed.apk
echo.
echo 将 APK 传到手机安装即可！
pause
:end
