:loop
node bot.js
IF %ERRORLEVEL% EQU 0 (
    echo Node.js script exited with code 0. Exiting.
    goto :eof
) ELSE (
    echo Node.js script exited with a non-zero code. Restarting...
    goto loop
)