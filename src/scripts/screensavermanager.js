import { playbackManager } from '../components/playback/playbackmanager';
import { pluginManager } from '../components/pluginManager';
import inputManager from './inputManager';
import * as userSettings from './settings/userSettings';
import ServerConnections from '../components/ServerConnections';
import { PluginType } from '../types/plugin.ts';
import Events from '../utils/events.ts';

import './screensavermanager.scss';

function getMinIdleTime() {
    // Returns the minimum amount of idle time required before the screen saver can be displayed
    //time units used Millisecond
    return userSettings.screensaverTime() * 1000;
}

let lastFunctionalEvent = 0;

function getFunctionalEventIdleTime() {
    return new Date().getTime() - lastFunctionalEvent;
}

Events.on(playbackManager, 'playbackstop', function (_e, stopInfo) {
    const state = stopInfo.state;
    if (state.NowPlayingItem && state.NowPlayingItem.MediaType == 'Video') {
        lastFunctionalEvent = new Date().getTime();
    }
});

function getScreensaverPlugin(isLoggedIn) {
    let option;
    try {
        option = userSettings.get('screensaver', false);
    } catch (err) {
        option = isLoggedIn ? 'backdropscreensaver' : 'logoscreensaver';
    }

    const plugins = pluginManager.ofType(PluginType.Screensaver);

    for (const plugin of plugins) {
        if (plugin.id === option) {
            return plugin;
        }
    }

    return null;
}

class ScreenSaverManager {
    constructor() {
        this.activeScreenSaver = null;
        this.listeners = {};

        setInterval(this.onInterval.bind(this), Math.floor(getMinIdleTime() / 10));
    }

    showScreenSaver(screensaver) {
        if (this.activeScreenSaver) {
            throw new Error('An existing screensaver is already active.');
        }

        console.debug('Showing screensaver ' + screensaver.name);

        document.body.classList.add('screensaver-noScroll');

        screensaver.show();
        this.activeScreenSaver = screensaver;

        if (screensaver.hideOnClick !== false) {
            this.listeners['click'] = this.hide.bind(this);
            window.addEventListener('click', this.listeners['click'], true);
        }
        if (screensaver.hideOnMouse !== false) {
            this.listeners['mousemove'] = this.hide.bind(this);
            window.addEventListener('mousemove', this.listeners['mousemove'], true);
        }
        if (screensaver.hideOnKey !== false) {
            this.listeners['keydown'] = this.hide.bind(this);
            window.addEventListener('keydown', this.listeners['keydown'], true);
        }
    }

    hide() {
        if (this.activeScreenSaver) {
            console.debug('Hiding screensaver');
            this.activeScreenSaver.hide().then(() => {
                document.body.classList.remove('screensaver-noScroll');
            });
            this.activeScreenSaver = null;
        }

        for (const event in this.listeners) {
            const listener = this.listeners[event];
            window.removeEventListener(event, listener, true);
        }

        this.listeners = {};
    }

    isShowing() {
        return this.activeScreenSaver != null;
    }

    show() {
        let isLoggedIn;
        const apiClient = ServerConnections.currentApiClient();

        if (apiClient?.isLoggedIn()) {
            isLoggedIn = true;
        }

        const screensaver = getScreensaverPlugin(isLoggedIn);

        if (screensaver) {
            this.showScreenSaver(screensaver);
        }
    }

    onInterval() {
        if (this.isShowing()) {
            return;
        }

        if (inputManager.idleTime() < getMinIdleTime()) {
            return;
        }

        if (getFunctionalEventIdleTime() < getMinIdleTime()) {
            return;
        }

        if (playbackManager.isPlayingVideo()) {
            return;
        }

        this.show();
    }
}

export default new ScreenSaverManager;
