# 🏨 ENAYI HOTELS & SUITES — Complete Windows 11 Setup Guide
### From Zero to Running: Offline & Online

---

## ══════════════════════════════════════════════════════
## PART 1: SYSTEM PREREQUISITES
## ══════════════════════════════════════════════════════

### STEP 1 — Check Windows Version
Open PowerShell and run:
```powershell
winver
```
You need Windows 11 (Build 22000+) or Windows 10 (Build 19045+).

---

### STEP 2 — Enable WSL2 (Windows Subsystem for Linux)
Open PowerShell AS ADMINISTRATOR and run:
```powershell
# Enable WSL and Virtual Machine Platform
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Restart your computer
Restart-Computer
```
After restart, open PowerShell AS ADMINISTRATOR again:
```powershell
# Set WSL2 as default
wsl --set-default-version 2

# Install Ubuntu
wsl --install -d Ubuntu

# Verify installation
wsl --list --verbose
```

---

### STEP 3 — Install Docker Desktop
- Download from: https://www.docker.com/products/docker-desktop/
- Run the installer AS ADMINISTRATOR
- When prompted:
  - ✅ Check "Use WSL 2 instead of Hyper-V"
  - ✅ Check "Add shortcut to desktop"
- Restart your computer when prompted
- Wait for the whale icon in the taskbar to turn GREEN

Verify in PowerShell:
```powershell
docker --version
docker-compose --version
```

---

### STEP 4 — Install Git for Windows
Download from: https://git-scm.com/download/win

Run installer with these settings:
- Use Git from the Windows Command Prompt ✅
- Use OpenSSH ✅
- Use the native Windows Secure Channel library ✅
- Checkout Windows-style, commit Unix-style ✅

Verify:
```powershell
git --version
```

---

### STEP 5 — Install Node.js 20 LTS
Download from: https://nodejs.org/ (LTS version)

Verify:
```powershell
node --version    # v20.x.x
npm --version     # 10.x.x
```

---

### STEP 6 — Install Python 3.11
Download from: https://www.python.org/downloads/

Run installer:
- ✅ Check "Add Python to PATH" (IMPORTANT!)
- Click "Install Now"

Verify:
```powershell
python --version   # Python 3.11.x
pip --version
```

---

### STEP 7 — Install VS Code
Download from: https://code.visualstudio.com/

Install recommended extensions:
```powershell
code --install-extension ms-python.python
code --install-extension bradlc.vscode-tailwindcss
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension ms-azuretools.vscode-docker
code --install-extension eamodio.gitlens
```

---

## ══════════════════════════════════════════════════════
## PART 2: PROJECT SETUP
## ══════════════════════════════════════════════════════

### STEP 8 — Create Project Directory
```powershell
New-Item -ItemType Directory -Force -Path "C:\Projects"
cd C:\Projects
New-Item -ItemType Directory -Force -Path "enayi-hotels"
cd enayi-hotels
code .
```

### STEP 9 — Create Directory Structure
```powershell
$dirs = @(
    "backend\config",
    "backend\apps\accounts",
    "backend\apps\rooms",
    "backend\apps\bookings",
    "backend\apps\orders",
    "backend\apps\events",
    "backend\apps\payments",
    "backend\apps\gallery",
    "backend\apps\ai_assistant",
    "backend\apps\dashboard",
    "backend\templates\emails",
    "backend\media\rooms",
    "backend\media\gallery",
    "backend\media\avatars",
    "backend\staticfiles",
    "backend\fixtures",
    "frontend\src\pages\auth",
    "frontend\src\pages\guest",
    "frontend\src\pages\admin",
    "frontend\src\pages\public",
    "frontend\src\components\layout",
    "frontend\src\components\ui",
    "frontend\src\components\rooms",
    "frontend\src\components\booking",
    "frontend\src\components\orders",
    "frontend\src\components\events",
    "frontend\src\components\gallery",
    "frontend\src\components\payment",
    "frontend\src\components\ai",
    "frontend\src\components\dashboard",
    "frontend\src\hooks",
    "frontend\src\store",
    "frontend\src\types",
    "frontend\src\utils",
    "frontend\src\assets\images",
    "frontend\src\assets\fonts",
    "frontend\public",
    "nginx",
    "docs",
    ".github\workflows"
)

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

Write-Host "All directories created!" -ForegroundColor Green
```

### STEP 10 — Setup Environment Variables
```powershell
Copy-Item .env.example .env
```
Generate Django secret key:
```powershell
python -c "import secrets; print(secrets.token_urlsafe(60))"
```

---

## ══════════════════════════════════════════════════════
## PART 3: RUNNING THE APP
## ══════════════════════════════════════════════════════

### Option A: Full Docker (Recommended)
```powershell
# Build and start all services
docker-compose up --build -d

# Check all containers are running
docker-compose ps

# Run database migrations
docker-compose exec backend python manage.py migrate

# Create admin superuser
docker-compose exec backend python manage.py createsuperuser

# Load initial seed data
docker-compose exec backend python manage.py loaddata fixtures/seed.json

# View logs
docker-compose logs -f backend

# Open in browser
start http://localhost:3000
start http://localhost:8000/admin
start http://localhost:8000/api/docs
start http://localhost:5050
```

### Option B: Manual (Without Docker)

**Terminal 1 — Start PostgreSQL:**
```powershell
docker-compose up db redis -d
```

**Terminal 2 — Django Backend:**
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

$env:DATABASE_URL="postgresql://enayi_user:enayi_pass@localhost:5432/enayi_hotels"
$env:REDIS_URL="redis://localhost:6379/0"
$env:SECRET_KEY="your-secret-key-here"
$env:DEBUG="True"

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

**Terminal 3 — React Frontend:**
```powershell
cd frontend
npm install
npm run dev
```

---

## ══════════════════════════════════════════════════════
## PART 4: GITHUB SETUP
## ══════════════════════════════════════════════════════

```powershell
git init
git branch -M main
git add .
git commit -m "feat: Enayi Hotels & Suites — complete HMS v1.0"

# Go to https://github.com/new and create repo first
git remote add origin https://github.com/YOUR_USERNAME/enayi-hotels.git
git push -u origin main
```

### GitHub Secrets for CI/CD
Go to: GitHub Repo → Settings → Secrets and Variables → Actions

Add these secrets:
```
SECRET_KEY
DATABASE_URL
OPENAI_API_KEY
FLUTTERWAVE_SECRET
PAYSTACK_SECRET
STRIPE_SECRET_KEY
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
VITE_FLUTTERWAVE_PK
VITE_PAYSTACK_PK
VITE_STRIPE_PK
VITE_PAYPAL_CLIENT_ID
```

---

## ══════════════════════════════════════════════════════
## PART 5: USEFUL DOCKER COMMANDS
## ══════════════════════════════════════════════════════

```powershell
# See all running containers
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db

# Restart a service
docker-compose restart backend

# Stop all services
docker-compose down

# Fresh start (deletes all data)
docker-compose down -v --remove-orphans

# Rebuild after package changes
docker-compose up --build -d

# Django shell
docker-compose exec backend python manage.py shell

# Database backup
docker-compose exec db pg_dump -U enayi_user enayi_hotels > backup_$(Get-Date -Format "yyyyMMdd").sql

# Run migrations
docker-compose exec backend python manage.py makemigrations
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py collectstatic

# Access PostgreSQL directly
docker-compose exec db psql -U enayi_user -d enayi_hotels
```

---

## URLS WHEN RUNNING

| Service       | URL                              |
|---------------|----------------------------------|
| Frontend      | http://localhost:3000            |
| API Base      | http://localhost:8000/api/v1/    |
| API Swagger   | http://localhost:8000/api/docs/  |
| API ReDoc     | http://localhost:8000/api/redoc/ |
| Django Admin  | http://localhost:8000/admin/     |
| PgAdmin       | http://localhost:5050            |
| Redis         | localhost:6379                   |

---

## TROUBLESHOOTING

**Docker won't start:**
```powershell
Restart-Service com.docker.service
```

**Port already in use:**
```powershell
netstat -ano | findstr :8000
taskkill /PID 12345 /F
```

**PowerShell execution policy error:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**WSL2 memory issue:**
Create/edit `C:\Users\YOUR_NAME\.wslconfig`:
```ini
[wsl2]
memory=4GB
processors=2
swap=2GB
```
Then restart WSL:
```powershell
wsl --shutdown
```

**Cannot connect to database:**
```powershell
# Wait 30 seconds after docker-compose up
docker-compose ps
docker-compose logs db
```
