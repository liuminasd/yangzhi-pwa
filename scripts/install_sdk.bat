@echo off
chcp 65001 >nul
set ANDROID_HOME=C:\Users\32066\android-sdk
set JAVA_HOME=C:\PROGRA~1\Microsoft\jdk-21.0.12.8-hotspot

echo JAVA_HOME=%JAVA_HOME%
dir "%JAVA_HOME%\bin\java.exe" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Java not found at %JAVA_HOME%\bin\java.exe
    exit /b 1
)

REM Accept licenses first
echo y | "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root=%ANDROID_HOME% --licenses

REM Install SDK components
"%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root=%ANDROID_HOME% "platform-tools" "platforms;android-34" "build-tools;34.0.0"

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: sdkmanager failed
    exit /b %ERRORLEVEL%
)
echo Done!
