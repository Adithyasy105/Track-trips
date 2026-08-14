const UPDATE_EVENT = 'tripsync-sw-update-ready';

export function registerServiceWorker() {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${process.env.PUBLIC_URL}/service-worker.js`, { updateViaCache: 'none' })
      .then((registration) => {
        const notifyUpdate = (worker) => {
          if (navigator.serviceWorker.controller && worker) {
            window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { worker } }));
          }
        };

        if (registration.waiting) {
          notifyUpdate(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;

          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') {
              notifyUpdate(worker);
            }
          });
        });
      })
      .catch((error) => {
        // A PWA enhancement must never affect the existing application.
        console.warn('TripSync service worker registration failed:', error);
      });
  });
}

export const PWA_UPDATE_EVENT = UPDATE_EVENT;
