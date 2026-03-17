import { app, BrowserWindow, shell, Menu, screen } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let apiProcess: ChildProcess | null = null;

// Use app.isPackaged to detect production vs development
const isDev = !app.isPackaged;
const API_PORT = process.env.API_PORT || '8001';

// Check if API is already running
function checkApiRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: parseInt(API_PORT),
        path: '/system/ping',
        method: 'GET',
        timeout: 2000,
      },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function startApiServer(): Promise<void> {
  if (process.env.SKIP_API === 'true') {
    console.log('Skipping API server (SKIP_API=true)');
    console.log('Make sure to run the API separately: cd api && go run ./cmd/api');
    return;
  }

  // Check if API is already running (e.g., from Docker container)
  const apiAlreadyRunning = await checkApiRunning();
  if (apiAlreadyRunning) {
    console.log(`API already running on port ${API_PORT}, skipping embedded API startup`);
    return;
  }

  // In development, try to find API binary in the api/bin folder
  // In production, it's bundled in resources/api
  let apiPath: string;
  const apiExecutable = process.platform === 'win32' ? 'api.exe' : 'api';
  
  if (isDev) {
    // Development: look for binary in api/bin (relative to app folder)
    apiPath = path.join(__dirname, '..', '..', 'api', 'bin', apiExecutable);
  } else {
    // Production: bundled in resources
    apiPath = path.join(process.resourcesPath, 'api', apiExecutable);
  }

  console.log(`Looking for API at: ${apiPath}`);

  if (!existsSync(apiPath)) {
    console.log('API binary not found. Running without embedded API.');
    console.log('To build the API binary: cd api && go build -o bin/api ./cmd/api');
    console.log('Or run the API separately: cd api && go run ./cmd/api');
    return;
  }

  console.log(`Starting API server from: ${apiPath}`);

  apiProcess = spawn(apiPath, [], {
    env: {
      ...process.env,
      PORT: API_PORT,
      DOCKER_HOST: process.env.DOCKER_HOST || 'unix:///var/run/docker.sock',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  apiProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[API] ${data.toString().trim()}`);
  });

  apiProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[API Error] ${data.toString().trim()}`);
  });

  apiProcess.on('error', (err: Error) => {
    console.error('Failed to start API server:', err);
  });

  apiProcess.on('exit', (code: number | null) => {
    console.log(`API server exited with code ${code}`);
    apiProcess = null;
  });
}

function stopApiServer(): void {
  if (apiProcess) {
    console.log('Stopping API server...');
    apiProcess.kill('SIGTERM');
    apiProcess = null;
  }
}

function createWindow(): void {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  // Calculate window size (85% of screen size)
  const windowWidth = Math.min(Math.floor(screenWidth * 0.85), 1400);
  const windowHeight = Math.min(Math.floor(screenHeight * 0.85), 900);
  
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 800,
    minHeight: 600,
    title: 'Docker Manager',
    icon: path.join(__dirname, '../public/icon.png'),
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Register F12 to toggle DevTools (dev only)
  if (isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        mainWindow?.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  }

  // Create menu with DevTools option
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        ...(isDev ? [{
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => mainWindow?.webContents.toggleDevTools(),
        } as Electron.MenuItemConstructorOptions] : []),
        { type: 'separator' } as Electron.MenuItemConstructorOptions,
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startApiServer();
  
  // Wait a bit for API to start
  setTimeout(createWindow, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopApiServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopApiServer();
});
