// Keep this import first: it sends the initial requests before the rest of the app is set up.
import './prefetch';
import { createApp } from 'vue';
import App from './App.vue';
import '../styles/base.css';

// popup.html and sidepanel.html share this entry, so each page loads a single script.
const mode = document.body.classList.contains('sidepanel') ? 'sidepanel' : 'popup';
document.documentElement.lang = chrome.i18n.getUILanguage();
createApp(App, { mode }).mount('#app');
