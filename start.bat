@echo off
SETLOCAL

REM Set a descriptive title for the command prompt window
title Lilypad Environment Launcher

REM Define variables for clarity and consistency
set SCRIPT_NAME=%~n0%~x0
set DEVELOPMENT_FLAG=--dev
set NODE_ENV_DEV=development
set NODE_ENV_PROD=production
set NPM_CMD=npm.cmd

echo.
echo %SCRIPT_NAME% - Lilypad Application Launcher
echo ---------------------------------------------------
echo.

REM --- Basic Usage Help ---
IF /I "%1"=="-h" GOTO usage
IF /I "%1"=="--help" GOTO usage

REM --- Argument Handling ---
SET IS_DEVELOPMENT=false
IF /I "%1"=="%DEVELOPMENT_FLAG%" (
    SET IS_DEVELOPMENT=true
    REM Shift arguments so %1 becomes the next argument (if any)
    SHIFT
) ELSE (
    REM If the first argument is not the dev flag, check if it's empty
    IF NOT "%~1"=="" (
        echo ERROR: Unrecognized argument "%~1".
        GOTO usage
    )
)

REM --- Decide Mode and Execute ---
IF "%IS_DEVELOPMENT%"=="true" (
    GOTO dev_mode
) ELSE (
    GOTO prod_mode
)

REM --- Development Mode ---
:dev_mode
echo Using development environment...
set NODE_ENV=%NODE_ENV_DEV%
echo Setting NODE_ENV=%NODE_ENV%
echo.

echo Starting development build watcher (npm run watch)...
REM Use START /B to run npm in the background without opening a new console window
REM The first quoted string is the window title for the background process
start "Lilypad Dev Watcher" /B %NPM_CMD% run watch
REM Note: ERRORLEVEL check after START /B might not reliably indicate the child process's success

echo Starting the application (npm run start)...
start "Lilypad Application" /B %NPM_CMD% run start
REM Note: ERRORLEVEL check after START /B might not reliably indicate the child process's success

echo.
echo Script execution potentially completed.
echo Development watcher and application should be running in separate background processes.
echo Check Task Manager or separate console windows if they were not started /B.

GOTO :end

REM --- Production Mode ---
:prod_mode
echo Using production environment...
set NODE_ENV=%NODE_ENV_PROD%
echo Setting NODE_ENV=%NODE_ENV%
echo.

echo Building and starting the application (npm run start:prod)...
REM Use CALL to run the npm script and wait for it to complete
call %NPM_CMD% run start:prod
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build and start the application in production mode.
    GOTO :cleanup
)
echo Production build and start command completed.

GOTO :end

REM --- Usage Instructions ---
:usage
echo Usage: %SCRIPT_NAME% [%DEVELOPMENT_FLAG%]
echo.
echo   %DEVELOPMENT_FLAG%     - Runs the application in development mode (starts webpack watcher and app).
echo   (no argument)       - Runs the application in production mode (runs build then starts the app).
echo.
GOTO :end

REM --- Cleanup (optional but good practice) ---
:cleanup
echo.
echo Performing cleanup...
REM Add any necessary cleanup steps here if needed

:end
echo.
ENDLOCAL
