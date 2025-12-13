/**
 * Cloud Sync UI entry (MV3-safe: no inline scripts)
 *
 * Loads the module-based Sync UI controller and exposes it to popup.js.
 */

import * as SyncUIController from './sync-ui-controller.js';

window.SyncUIController = SyncUIController;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    SyncUIController.initialize();
  });
} else {
  SyncUIController.initialize();
}

