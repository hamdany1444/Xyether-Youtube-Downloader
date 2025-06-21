/*
=====================================================
    1. File Name: main.js
=====================================================
*/

const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('path');
const { execFile } = require('child_process');
const Store = require('electron-store');
const fs = require('fs');

// --- CONFIG & SETUP ---
const store = new Store({
    windowBounds: { width: 480, height: 850 }
});
const isDev = !app.isPackaged;
let mainWindow;

// --- UTILITY FUNCTIONS ---
const getAssetPath = (assetName) => {
    return isDev ? path.join(__dirname, assetName) : path.join(process.resourcesPath, assetName);
};

function validateWindowBounds(bounds) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: displayWidth, height: displayHeight } = primaryDisplay.workAreaSize;
    const isVisible = (b) => b.x >= 0 && b.y >= 0 && b.x + b.width <= displayWidth && b.y + b.height <= displayHeight;
    if (!bounds || !isVisible(bounds)) {
        return { width: 480, height: 850, x: undefined, y: undefined };
    }
    return bounds;
}

// --- BROWSER WINDOW ---
function createWindow() {
    const ytDlpPath = getAssetPath('yt-dlp.exe');
    if (!fs.existsSync(ytDlpPath)) {
        dialog.showErrorBox('Dependency Missing', 'yt-dlp.exe was not found. Please make sure it is in the application directory.');
        return app.quit();
    }
    const sanitizedBounds = validateWindowBounds(store.get('windowBounds'));
    mainWindow = new BrowserWindow({
        ...sanitizedBounds,
        minWidth: 450,
        minHeight: 700,
        icon: getAssetPath('icon.ico'),
        webPreferences: { preload: path.join(__dirname, 'preload.js') },
        autoHideMenuBar: true,
        show: false,
        frame: true,
    });
    const saveBounds = () => store.set('windowBounds', mainWindow.getBounds());
    mainWindow.on('resize', saveBounds);
    mainWindow.on('move', saveBounds);
    mainWindow.loadFile('index.html');
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.on('closed', () => { mainWindow = null; });
}

// --- IPC HANDLERS ---
function setupIpcHandlers() {
    // Settings & System Interaction
    ipcMain.handle('get-setting', (_, key, defaultValue) => store.get(key, defaultValue));
    ipcMain.handle('set-setting', (_, key, value) => store.set(key, value));
    ipcMain.handle('select-directory', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
        if (mainWindow) mainWindow.focus();
        return canceled ? null : filePaths[0];
    });
    ipcMain.handle('show-item-in-folder', (_, filePath) => {
        if(filePath && fs.existsSync(filePath)) {
            shell.showItemInFolder(filePath);
        } else {
            dialog.showErrorBox('File Not Found', 'The downloaded file could not be found.');
        }
    });
    ipcMain.handle('open-external-link', (_, url) => shell.openExternal(url));
    
    // Video Info Fetching
    ipcMain.handle('fetch-video-info', (_, url) => {
        return new Promise((resolve, reject) => {
            if (!url) return reject(new Error('URL is empty.'));
            execFile(getAssetPath('yt-dlp.exe'), ['-J', '--no-warnings', url], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                if (error) return reject(new Error(`Failed to fetch data: ${stderr || error.message}`));
                try { resolve(JSON.parse(stdout)); } catch (e) { reject(new Error("Failed to parse video data from yt-dlp.")); }
            });
        });
    });

    // --- FINALIZED Download Handler ---
    ipcMain.on('download-video', async (event, options) => {
        const { url, formatId, recode, crf, videoTitle } = options;
        const isMp3 = formatId === 'mp3';
        const extension = isMp3 ? 'mp3' : 'mp4';
        
        let savePath;
        const defaultPath = store.get('defaultPath');
        
        if (defaultPath && fs.existsSync(defaultPath)) {
            savePath = path.join(defaultPath, `${(videoTitle || 'video').replace(/[\\/:*?"<>|]/g, '_')}.${extension}`);
        } else {
             const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                title: `Save ${isMp3 ? 'Audio' : 'Video'}`,
                defaultPath: `${(videoTitle || 'video').replace(/[\\/:*?"<>|]/g, '_')}.${extension}`,
                filters: isMp3 ? [{ name: 'Audio', extensions: ['mp3'] }] : [{ name: 'Videos', extensions: ['mp4'] }]
            });
            if (mainWindow) mainWindow.focus();
            if (canceled || !filePath) {
                return event.sender.send('download-error', 'Download was cancelled.');
            }
            savePath = filePath;
        }

        const args = [
            '--paths', `temp:${app.getPath('temp')}`,
            '--no-mtime',
            '--ffmpeg-location', getAssetPath('.'),
            '--no-warnings',
            '--progress',
            '-o', savePath,
            url
        ];

        if (isMp3) {
            args.push('-f', 'bestaudio/best', '-x', '--audio-format', 'mp3');
        } else {
            args.push('-f', formatId);
            if (recode) {
                args.push('--recode-video', 'mp4', '--postprocessor-args', `ffmpeg:-crf ${crf}`);
            } else {
                args.push('--merge-output-format', 'mp4');
            }
        }
        
        const child = execFile(getAssetPath('yt-dlp.exe'), args);

        child.stdout.on('data', (data) => {
            const progressMatch = /\[download\]\s+([\d\.]+)% of.*?([\d\.]+\w+iB) at ([\d\.]+\w+iB\/s)/.exec(data.toString());
            if (progressMatch) { event.sender.send('download-progress', {
                percent: parseFloat(progressMatch[1]), totalSize: progressMatch[2], speed: progressMatch[3],
            });}
        });

        let lastStdErr = '';
        child.stderr.on('data', (data) => { lastStdErr = data.toString(); });

        child.on('close', (code) => {
            if (code === 0) { event.sender.send('download-complete', { message: 'Download finished!', filePath: savePath }); }
            else { event.sender.send('download-error', `Process exited with error. Message: ${lastStdErr}`); }
        });

        child.on('error', (err) => event.sender.send('download-error', err.message));
    });
}

// --- APP LIFECYCLE ---
app.whenReady().then(() => {
    setupIpcHandlers();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
