import { createApp } from 'vue';
import App from '../ui/App.vue';
import '../styles/base.css';

document.documentElement.lang = chrome.i18n.getUILanguage();
createApp(App, { mode: 'sidepanel' }).mount('#app');
