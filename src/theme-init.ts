/**
 * Blocking first-paint bootstrap: read saved settings from localStorage and
 * apply theme/fonts before the React bundle loads. Bundled to theme-init.js
 * and injected into index.html by the Vite theme-init plugin.
 */
import { applySettingsToDocument } from './lib/apply-document-settings';
import { validateSettings } from './lib/settings';
import { loadValidated } from './lib/storage';

applySettingsToDocument(loadValidated('settings', validateSettings, undefined, 'shared'));
