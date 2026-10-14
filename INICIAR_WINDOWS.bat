@echo off
cd /d "%~dp0"
echo Instalando dependencias de la tienda...
call npm install
if errorlevel 1 (
 echo Error instalando dependencias. Revisar Node.js y conexion a Internet.
 pause
 exit /b 1
)
echo.
echo TIENDA: http://localhost:5173
echo ADMIN:  http://localhost:5173/admin
echo Usuario: admin   Clave de prueba: amin1
echo.
call npm run dev
pause
