'use client';

/**
 * Shared external store and small presentational primitives for the BotSettingsPanel right-bar.
 */

import React, { useCallback, useSyncExternalStore } from 'react';
import type { useApp } from '../../context/AppContext';
import type { Copy } from '../../i18n';
import {
  PANEL_DOCK_MIN_WIDTH,
  readPanelPref,
  writePanelPref,
  type DraftError,
} from '../../bot-settings-panel-logic';

interface PanelState {
  desktopOpen: boolean;
  drawerOpen: boolean;
}

const SERVER_PANEL_STATE: PanelState = { desktopOpen: true, drawerOpen: false };
let panelState: PanelState = SERVER_PANEL_STATE;
let panelHydrated = false;
const panelListeners = new Set<() => void>();

const setPanelState = (next: PanelState) => {
  panelState = next;
  panelListeners.forEach((listener) => listener());
};

const subscribePanel = (listener: () => void) => {
  panelListeners.add(listener);
  return () => {
    panelListeners.delete(listener);
  };
};

const getPanelSnapshot = (): PanelState => {
  if (!panelHydrated && typeof window !== 'undefined') {
    panelHydrated = true;
    const desktopOpen = readPanelPref(window.localStorage);
    if (desktopOpen !== panelState.desktopOpen) panelState = { ...panelState, desktopOpen };
  }
  return panelState;
};

const getServerPanelSnapshot = (): PanelState => SERVER_PANEL_STATE;

const DOCK_QUERY = `(min-width: ${PANEL_DOCK_MIN_WIDTH}px)`;
const subscribeDock = (listener: () => void) => {
  const query = window.matchMedia(DOCK_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};
const getDockSnapshot = () => window.matchMedia(DOCK_QUERY).matches;
const getServerDockSnapshot = () => false;

export const useBotSettingsPanel = () => {
  const state = useSyncExternalStore(subscribePanel, getPanelSnapshot, getServerPanelSnapshot);
  const docked = useSyncExternalStore(subscribeDock, getDockSnapshot, getServerDockSnapshot);
  const visible = docked ? state.desktopOpen : state.drawerOpen;

  const toggle = useCallback(() => {
    const current = getPanelSnapshot();
    if (window.matchMedia(DOCK_QUERY).matches) {
      const desktopOpen = !current.desktopOpen;
      writePanelPref(window.localStorage, desktopOpen);
      setPanelState({ ...current, desktopOpen });
    } else {
      setPanelState({ ...current, drawerOpen: !current.drawerOpen });
    }
  }, []);

  const close = useCallback(() => {
    const current = getPanelSnapshot();
    if (window.matchMedia(DOCK_QUERY).matches) {
      writePanelPref(window.localStorage, false);
      setPanelState({ ...current, desktopOpen: false });
    } else {
      setPanelState({ ...current, drawerOpen: false });
    }
  }, []);

  return { docked, visible, toggle, close };
};

export const resetDrawer = () => {
  const current = getPanelSnapshot();
  if (current.drawerOpen) setPanelState({ ...current, drawerOpen: false });
};

export const Initial: React.FC<{ name: string; size?: 'sm' | 'md' }> = ({ name, size = 'md' }) => (
  <span
    aria-hidden="true"
    className={`flex shrink-0 items-center justify-center rounded-full bg-brass/15 font-bold uppercase text-brass ${
      size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'
    }`}
  >
    {(name.trim()[0] ?? '?').toUpperCase()}
  </span>
);

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
    {children}
  </h3>
);

export type ChatRoomState = NonNullable<ReturnType<typeof useApp>['currentRoom']>;

export const draftErrorLabel = (t: Copy, error: DraftError): string => {
  switch (error) {
    case 'name':
      return t.wsErrorName;
    case 'instruction':
      return t.wsErrorInstruction;
    case 'provider':
      return t.wsErrorProvider;
    case 'model':
      return t.wsErrorModel;
  }
};
