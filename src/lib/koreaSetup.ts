const LS_KEY = 'wayknit:korea-setup:v1';

export interface SetupItem {
  id: string;
  labelKey: string;
}

export const KOREA_SETUP_ITEMS: SetupItem[] = [
  { id: 'esim', labelKey: 'setup.items.esim' },
  { id: 'tmoney', labelKey: 'setup.items.tmoney' },
  { id: 'maps', labelKey: 'setup.items.maps' },
  { id: 'airport', labelKey: 'setup.items.airport' },
  { id: 'exchange', labelKey: 'setup.items.exchange' },
  { id: 'emergency', labelKey: 'setup.items.emergency' },
];

export function readSetupProgress(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function writeSetupProgress(progress: Record<string, boolean>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function toggleSetupItem(id: string): Record<string, boolean> {
  const prev = readSetupProgress();
  const next = { ...prev, [id]: !prev[id] };
  writeSetupProgress(next);
  return next;
}
