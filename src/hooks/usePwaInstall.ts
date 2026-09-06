import { useCallback, useEffect, useRef, useState } from 'react';

const DISMISS_KEY = 'wayknit:pwa-install-dismissed-v1';

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissPwaInstallPrompt(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function usePwaInstall() {
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPromptInstall, setCanPromptInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneMode());
  const [isIOS, setIsIOS] = useState(() => isIosDevice());
  const [iosHintOpen, setIosHintOpen] = useState(false);

  useEffect(() => {
    setIsStandalone(isStandaloneMode());
    setIsIOS(isIosDevice());

    const onBip = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      deferredRef.current = e;
      if (!isStandaloneMode() && !isDismissed()) {
        setCanPromptInstall(true);
      }
    };

    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  const showInstallButton = !isStandalone && !isDismissed() && (canPromptInstall || isIOS);

  const install = useCallback(async () => {
    const deferred = deferredRef.current;
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferredRef.current = null;
      if (outcome === 'accepted') {
        setCanPromptInstall(false);
        setIsStandalone(isStandaloneMode());
      }
      return;
    }
    if (isIOS) {
      setIosHintOpen(true);
    }
  }, [isIOS]);

  const dismiss = useCallback(() => {
    dismissPwaInstallPrompt();
    setCanPromptInstall(false);
    setIosHintOpen(false);
  }, []);

  return {
    showInstallButton,
    install,
    dismiss,
    iosHintOpen,
    closeIosHint: () => setIosHintOpen(false),
    isStandalone,
  };
}
