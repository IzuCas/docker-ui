import { contextBridge } from 'electron';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  
  // API configuration
  getApiUrl: () => {
    const port = process.env.API_PORT || '8001';
    return `http://localhost:${port}`;
  },
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      isElectron: boolean;
      getApiUrl: () => string;
    };
  }
}
