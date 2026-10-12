import type { LucideIcon } from 'lucide-react';
import {
  CreditCard,
  KeyRound,
  MessageSquareText,
  MessagesSquare,
  Settings,
  UsersRound,
} from 'lucide-react';
import type { ViewType } from './types';

export type NavLabelKey =
  | 'sessions'
  | 'chatRoom'
  | 'personas'
  | 'apiKeys'
  | 'billing'
  | 'settings';

export type NavGroupLabelKey = 'workspace' | 'manage';

export interface NavItem {
  view: ViewType;
  labelKey: NavLabelKey;
  icon: LucideIcon;
}

export interface NavGroup {
  labelKey: NavGroupLabelKey;
  items: readonly NavItem[];
}

/**
 * The one and only workspace navigation definition.
 *
 * Header, Sidebar and the mobile disclosure panel all render from this array.
 * The previous build kept a second, hand-maintained copy of these destinations
 * inside Header.tsx; the two drifted, which is why the desktop sidebar showed
 * `Council room` but the mobile menu did not, and why `Billing` was reachable
 * from nowhere at all.
 *
 * Ordering is the answer to "which one do I click": the things you open to do
 * work come first, the things you open to administer come second.
 */
export const WORKSPACE_NAV: readonly NavGroup[] = [
  {
    labelKey: 'workspace',
    items: [
      { view: 'sessions', labelKey: 'sessions', icon: MessageSquareText },
      { view: 'chat-room', labelKey: 'chatRoom', icon: MessagesSquare },
      { view: 'personas', labelKey: 'personas', icon: UsersRound },
    ],
  },
  {
    labelKey: 'manage',
    items: [
      { view: 'api-keys', labelKey: 'apiKeys', icon: KeyRound },
      { view: 'billing', labelKey: 'billing', icon: CreditCard },
      { view: 'settings', labelKey: 'settings', icon: Settings },
    ],
  },
] as const;

/** Flat view list, for callers that just need "is this a workspace view". */
export const WORKSPACE_VIEWS: readonly ViewType[] = WORKSPACE_NAV.flatMap((group) =>
  group.items.map((item) => item.view),
);

/**
 * Landing-page destinations. All three are anchors on `/`: How it works, Why Zero Council and
 * Pricing all live on the landing page itself.
 *
 * Pricing used to be a `view`, so clicking it threw the visitor off the page into a separate
 * screen whose back button did not return them to the section they came from. A pricing table the
 * visitor has to leave the page to read is a worse answer to "what does it cost" than scrolling
 * to the table.
 */
export const MARKETING_NAV: readonly { labelKey: 'howItWorks' | 'whyZeroCouncil' | 'pricing'; href: string }[] = [
  { labelKey: 'howItWorks', href: '#how-it-works' },
  { labelKey: 'whyZeroCouncil', href: '#why-zero-council' },
  { labelKey: 'pricing', href: '#pricing' },
] as const;