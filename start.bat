@echo off
chcp 65001 >nul
title AI 聊天伴侣

echo.
echo   💬 AI 聊天伴侣
echo   ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
echo   正在启动本地服务器...
echo.

:: 尝试用 Python 启动
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   使用 Python HTTP 服务器
    echo   地址：http://localhost:8080
    echo   按 Ctrl+C 停止
    echo.
    start "" http://localhost:8080
    python -m http.server 8080
    goto :end
)

:: 尝试用 npx serve
where npx >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   使用 npx serve
    echo   地址：http://localhost:3000
    echo   按 Ctrl+C 停止
    echo.
    start "" http://localhost:3000
    npx serve .
    goto :end
)

:: 都没找到
echo   ❌ 未找到 Python 或 Node.js
echo   请安装 Python 或 Node.js 后重试
echo   或者手动用浏览器打开 index.html（需要服务器环境）
pause

:end
