@echo off
REM Build React for production and copy dist into Laravel public/app
REM Run from the frontend folder: cd C:\Users\HP\frontend && build.bat

echo Building React app...
call npm run build

echo Copying dist to Laravel public\app...
set DEST=..\callcenter-crm\public\app

if exist "%DEST%" (
    rmdir /s /q "%DEST%"
)
xcopy /e /i /y dist "%DEST%"

echo Done. Frontend assets are in public\app.
