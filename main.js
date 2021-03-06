/* global __dirname, process */

const {
    app: APP,
    BrowserWindow,
    Menu,
    shell
} = require('electron');
const isDev = require('electron-is-dev');
const { autoUpdater } = require('electron-updater');
const windowStateKeeper = require('electron-window-state');
const {
    setupAlwaysOnTopMain,
    initPopupsConfigurationMain,
    getPopupTarget
} = require('jitsi-meet-electron-utils');
const path = require('path');
const URL = require('url');

autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

/**
 * Load debug utilities (don't open the DevTools window by default though).
 */
require('electron-debug')({ showDevTools: false });

/**
 * Path to root directory
 */
const basePath = isDev ? __dirname : APP.getAppPath();

/**
 * URL for index.html which will be our entry point.
 */
const indexURL = URL.format({
    pathname: path.resolve(basePath, './build/index.html'),
    protocol: 'file:',
    slashes: true
});

/**
 * The window object that will load the iframe with Jitsi Meet.
 * IMPORTANT: Must be defined as global in order to not be garbage collected
 * acidentally.
 */
let jitsiMeetWindow = null;

/**
 * Force Single Instance Application
 */
const isSecondInstance = APP.makeSingleInstance(() => {
    /**
     * If someone creates second instance of the application, set focus on
     * existing window.
     */
    if (jitsiMeetWindow) {
        if (jitsiMeetWindow.isMinimized()) {
            jitsiMeetWindow.restore();
        }
        jitsiMeetWindow.focus();
    }
});

/**
 * We should quit the second instance.
 */
if (isSecondInstance) {
    APP.quit();
    process.exit(0);
}

/**
 * Sets the APP object listeners.
 */
function setAPPListeners() {
    APP.on('ready', createJitsiMeetWindow);
    APP.on('window-all-closed', () => {
        // Don't quit the application for macOS.
        if (process.platform !== 'darwin') {
            APP.quit();
        }
    });
    APP.on('activate', () => {
        if (jitsiMeetWindow === null) {
            createJitsiMeetWindow();
        }
    });
    APP.on('certificate-error',
        // eslint-disable-next-line max-params
        (event, webContents, url, error, certificate, callback) => {
            if (url.startsWith('https://localhost')) {
                event.preventDefault();
                callback(true);
            } else {
                callback(false);
            }
        }
    );
}

/**
 * Template for Application menu (MacOS)
 */
const template = [ {
    label: APP.getName(),
    submenu: [ {
        label: 'Quit',
        accelerator: 'Command+Q',
        click() {
            APP.quit();
        }
    } ]
}, {
    label: 'Edit',
    submenu: [ {
        label: 'Undo',
        accelerator: 'CmdOrCtrl+Z',
        selector: 'undo:'
    },
    {
        label: 'Redo',
        accelerator: 'Shift+CmdOrCtrl+Z',
        selector: 'redo:'
    },
    {
        type: 'separator'
    },
    {
        label: 'Cut',
        accelerator: 'CmdOrCtrl+X',
        selector: 'cut:'
    },
    {
        label: 'Copy',
        accelerator: 'CmdOrCtrl+C',
        selector: 'copy:'
    },
    {
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        selector: 'paste:'
    },
    {
        label: 'Select All',
        accelerator: 'CmdOrCtrl+A',
        selector: 'selectAll:'
    }
    ]
} ];

/**
 * Opens new window with index.html(Jitsi Meet is loaded in iframe there).
 */
function createJitsiMeetWindow() {
    if (process.platform === 'darwin') {
        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    } else {
        Menu.setApplicationMenu(null);
    }

    // Check for Updates.
    autoUpdater.checkForUpdatesAndNotify();

    // Load the previous state with fallback to defaults
    const jitsiMeetWindowState = windowStateKeeper({
        defaultWidth: 800,
        defaultHeight: 600
    });

    // Options used when creating the main Jitsi Meet window.
    const jitsiMeetWindowOptions = {
        x: jitsiMeetWindowState.x,
        y: jitsiMeetWindowState.y,
        width: jitsiMeetWindowState.width,
        height: jitsiMeetWindowState.height,
        icon: path.resolve(basePath, './resources/icons/icon_512x512.png'),
        minWidth: 800,
        minHeight: 600,
        show: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            nativeWindowOpen: true
        }
    };

    jitsiMeetWindow = new BrowserWindow(jitsiMeetWindowOptions);
    jitsiMeetWindowState.manage(jitsiMeetWindow);
    jitsiMeetWindow.loadURL(indexURL);
    initPopupsConfigurationMain(jitsiMeetWindow);

    jitsiMeetWindow.webContents.on('new-window', (event, url, frameName) => {
        const target = getPopupTarget(url, frameName);

        if (!target || target === 'browser') {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    setupAlwaysOnTopMain(jitsiMeetWindow);

    jitsiMeetWindow.on('closed', () => {
        jitsiMeetWindow = null;
    });
    jitsiMeetWindow.once('ready-to-show', () => {
        jitsiMeetWindow.show();
    });
}

//  Start the application:
setAPPListeners();
