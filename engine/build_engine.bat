@echo off
echo Building standalone Python engine...

REM Create a fresh virtual environment
python -m venv venv
call venv\Scripts\activate.bat

REM Install dependencies
python -m pip install --upgrade pip
pip install playwright pyinstaller

REM Build the standalone executable
pyinstaller --onefile --name extractor extractor.py

REM Create bin directory in electron project if it doesn't exist
if not exist ..\resources\bin mkdir ..\resources\bin

REM Move the built binary to the electron project resources folder
move /Y dist\extractor.exe ..\resources\bin\

echo Build complete! Binary located at ..\resources\bin\extractor.exe
