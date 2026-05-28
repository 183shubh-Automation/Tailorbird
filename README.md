# 🧪 Playwright Test Automation Suite



This repository contains automated end-to-end tests built using Playwright.  
The tests are designed to validate UI functionality, user workflows, and key features across browsers. 

### 🧰 Prerequisites  
Install [Node.js](https://nodejs.org/) and [Visual Studio Code](https://code.visualstudio.com/)  

### 1. Clone the repository
```bash
git clone https://github.com/Harshalogy/Tailorbird_ui_automation.git  
```
Open the Folder in Visual Code

### 2. Install dependencies
```bash
npm install
```
### 3. Install Playwright and browsers
```bash
npx playwright install  
```
## 🧭 Running Tests

### ▶ Run all tests
```bash
npx playwright test
```
### ▶ Run tests in headed mode (see browser)
```bash
npx playwright test --headed
```
### ▶ Run a specific test file

npx playwright test tests/example.spec.ts

### ▶ Generate and view the test report
```bash
npx playwright show-report
```


## 🧩 Project Structure

```
├── tests/                 # Playwright test scripts
├── playwright.config.ts   # Playwright configuration file
├── package.json           # Dependencies and npm scripts
├── utils/                 # Utility functions and helpers
└── README.md              # Project documentation
```

---

## Run these tests in Terminal
## 🟢 PowerShell (Windows)
```bash
if (Test-Path "Tailorbird_ui_automation") { Remove-Item -Recurse -Force "Tailorbird_ui_automation" }; git clone https://github.com/Harshalogy/Tailorbird_ui_automation.git; cd Tailorbird_ui_automation; npm install; npx playwright install chromium; npx playwright test --headed; npx playwright show-report
```
## 🟠 Command Prompt (CMD) or macOS/Linux Terminal
```bash
IF EXIST "Tailorbird_ui_automation" (rmdir /s /q "Tailorbird_ui_automation") && git clone https://github.com/Harshalogy/Tailorbird_ui_automation.git && cd Tailorbird_ui_automation && npm install && npx playwright install chromium && npx playwright test --headed && npx playwright show-report
```
## 🟠 If Node.js is also not install, run this command
```bash
command -v node >/dev/null 2>&1 || { echo "Node.js not found. Installing..."; sudo apt update && sudo apt install -y nodejs npm; }; [ -d "Tailorbird_ui_automation" ] && rm -rf Tailorbird_ui_automation; git clone https://github.com/Harshalogy/Tailorbird_ui_automation.git && cd Tailorbird_ui_automation && npm install && npx playwright install chromium && npx playwright test --headed && npx playwright show-report
```



## 📊 View Test Results (GitHub Actions)

You can view the latest Playwright HTML test reports published from GitHub Actions here:
👉 https://harshalogy.github.io/Tailorbird_ui_automation/
