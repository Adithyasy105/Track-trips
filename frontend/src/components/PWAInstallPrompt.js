import React, { useEffect, useMemo, useState } from 'react';
import { FaDownload, FaMobileAlt, FaRedoAlt, FaTimes } from 'react-icons/fa';
import { PWA_UPDATE_EVENT } from '../pwa/registerServiceWorker';
import { useAuth } from '../context/AuthContext';

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIosSafari = () => {
  const userAgent = window.navigator.userAgent;
  // All iOS browsers use WebKit and require the Share → Add to Home Screen
  // flow; Chrome/Edge/Brave on iOS do not expose beforeinstallprompt.
  return /iphone|ipad|ipod/i.test(userAgent);
};

// This module owns the browser install event so every install control shares one state source.
let installState = {
  deferredPrompt: typeof window === 'undefined' ? null : window.__tripSyncDeferredInstallPrompt || null,
  installed: typeof window !== 'undefined' && isStandalone(),
};
const installSubscribers = new Set();
let installTrackingStarted = false;

const notifyInstallSubscribers = () => installSubscribers.forEach((listener) => listener(installState));

const startInstallTracking = () => {
  if (installTrackingStarted || typeof window === 'undefined') return;
  installTrackingStarted = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.__tripSyncDeferredInstallPrompt = event;
    installState = { ...installState, deferredPrompt: event };
    notifyInstallSubscribers();
  });

  window.addEventListener('appinstalled', () => {
    window.__tripSyncDeferredInstallPrompt = null;
    installState = { deferredPrompt: null, installed: true };
    notifyInstallSubscribers();
  });
};

startInstallTracking();

const DISMISS_KEY = 'tripsync-install-dismissed-at';
const DISMISS_TTL = 1000 * 60 * 60 * 24;

const wasRecentlyDismissed = () => {
  if (typeof window === 'undefined') return false;
  const value = window.localStorage.getItem(DISMISS_KEY);
  if (!value) return false;
  const dismissedAt = Number(value);
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_TTL;
};

const usePwaInstall = () => {
  const [state, setState] = useState(installState);

  useEffect(() => {
    startInstallTracking();
    installSubscribers.add(setState);
    return () => installSubscribers.delete(setState);
  }, []);

  const install = async () => {
    const prompt = installState.deferredPrompt;
    if (!prompt) return;

    prompt.prompt();
    try {
      await prompt.userChoice;
    } finally {
      window.__tripSyncDeferredInstallPrompt = null;
      installState = { ...installState, deferredPrompt: null };
      notifyInstallSubscribers();
    }
  };

  return { ...state, install, ios: isIosSafari() };
};

const IosInstallHelp = ({ onClose, className = '' }) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className={`z-50 rounded-xl border border-slate-700 bg-slate-900 p-3 text-left text-xs leading-5 text-slate-200 shadow-xl ${className}`} role="dialog" aria-label="Add TripSync to Home Screen">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1"><p className="font-bold text-white">Add TripSync to Home Screen</p><p className="mt-1">Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</p></div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-300 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-300" aria-label="Close installation instructions"><FaTimes /></button>
      </div>
    </div>
  );
};

const BrowserInstallHelp = ({ onClose, className = '' }) => {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isBrave = /Brave/i.test(userAgent) || (typeof navigator !== 'undefined' && !!navigator.brave);
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className={`z-50 rounded-xl border border-slate-700 bg-slate-900 p-3 text-left text-xs leading-5 text-slate-200 shadow-xl ${className}`} role="dialog" aria-label="Install TripSync">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white">Install TripSync</p>
          {isBrave ? (
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>Open the Brave menu (⋮).</li>
              <li>Choose <strong>Install TripSync</strong>.</li>
              <li>Confirm with <strong>Install</strong>.</li>
            </ol>
          ) : (
            <p className="mt-1">Open the browser menu and choose <strong>Install TripSync</strong> or <strong>Add to Home screen</strong>.</p>
          )}
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-300 hover:bg-slate-800 hover:text-white" aria-label="Close installation instructions"><FaTimes /></button>
      </div>
    </div>
  );
};

export const PWAInstallButton = ({ className = '', showLabel = false, title }) => {
  const { deferredPrompt, installed, install, ios } = usePwaInstall();
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showBrowserHelp, setShowBrowserHelp] = useState(false);
  const ariaLabel = title || 'Install TripSync';
  const buttonClassName = useMemo(
    () =>
      `inline-flex h-10 items-center justify-center rounded-xl border border-primary-400/40 bg-primary-600 text-white shadow-md shadow-primary-600/20 transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 ${showLabel ? 'gap-2 px-3.5 text-sm font-semibold' : 'w-10'} ${className}`,
    [className, showLabel]
  );

  if (installed) return null;

  const handleInstall = () => {
    if (ios) return setShowIosHelp((shown) => !shown);
    if (deferredPrompt) return install();
    return setShowBrowserHelp((shown) => !shown);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={handleInstall}
        className={buttonClassName}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <FaDownload className="h-3.5 w-3.5" aria-hidden="true" />
        {showLabel && <span className="hidden sm:inline">Install</span>}
      </button>
      {showIosHelp && <IosInstallHelp onClose={() => setShowIosHelp(false)} className="fixed left-3 right-3 top-[calc(4.5rem+env(safe-area-inset-top))] w-auto max-w-none sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-64" />}
      {showBrowserHelp && <BrowserInstallHelp onClose={() => setShowBrowserHelp(false)} className="fixed left-3 right-3 top-[calc(4.5rem+env(safe-area-inset-top))] w-auto max-w-none sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-64" />}
    </div>
  );
};

export const PWAInstallPrompt = () => {
  const { deferredPrompt, installed, install, ios } = usePwaInstall();
  const { user } = useAuth();
  const [updateWorker, setUpdateWorker] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showBrowserHelp, setShowBrowserHelp] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handleUpdate = (event) => setUpdateWorker(event.detail?.worker || null);
    window.addEventListener(PWA_UPDATE_EVENT, handleUpdate);
    return () => window.removeEventListener(PWA_UPDATE_EVENT, handleUpdate);
  }, []);

  useEffect(() => {
    setReady(true);
    setDismissed(wasRecentlyDismissed());
  }, []);

  const applyUpdate = () => {
    if (!updateWorker) return;
    updateWorker.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  };

  if (updateWorker) {
    return (
      <aside className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-sky-200 bg-white p-3 shadow-xl dark:border-sky-800 dark:bg-gray-900" role="status">
        <FaRedoAlt className="h-4 w-4 shrink-0 text-primary-600" />
        <p className="min-w-0 flex-1 text-xs font-medium text-gray-700 dark:text-gray-200">An app update is ready.</p>
        <button type="button" onClick={applyUpdate} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">Update</button>
        <button type="button" onClick={() => setUpdateWorker(null)} aria-label="Dismiss update" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><FaTimes /></button>
      </aside>
    );
  }

  // Show the larger install suggestion after authentication, when the user
  // is inside the app. The compact Layout button remains available elsewhere.
  if (!ready || !user || installed || dismissed) return null;

  const dismissInstall = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <aside
      className="fixed left-3 right-3 top-[calc(4.75rem+env(safe-area-inset-top))] z-50 mx-auto w-[min(100%,26rem)] rounded-2xl border border-sky-200 bg-white p-4 shadow-2xl shadow-slate-900/10 dark:border-sky-800 dark:bg-gray-900 sm:left-auto sm:right-4 sm:top-[calc(5rem+env(safe-area-inset-top))]"
      role="dialog"
      aria-label="Install TripSync"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300">
          <FaMobileAlt className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-white">Install TripSync</p>
          <p className="mt-0.5 text-xs leading-5 text-gray-600 dark:text-gray-300">
            Add it to your home screen for faster access and a cleaner app-like view.
          </p>
        </div>
        <button
          type="button"
          onClick={dismissInstall}
          aria-label="Dismiss install suggestion"
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <FaTimes />
        </button>
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={dismissInstall}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={ios ? () => setShowIosHelp(true) : deferredPrompt ? install : () => setShowBrowserHelp(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <FaDownload aria-hidden="true" /> {deferredPrompt || ios ? 'Install' : 'How to install'}
        </button>
      </div>
      {showIosHelp && <IosInstallHelp onClose={() => setShowIosHelp(false)} className="absolute inset-x-0 top-[calc(100%+0.5rem)]" />}
      {showBrowserHelp && <BrowserInstallHelp onClose={() => setShowBrowserHelp(false)} className="absolute inset-x-0 top-[calc(100%+0.5rem)]" />}
    </aside>
  );
};
