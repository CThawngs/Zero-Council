import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  ViewType,
  Language,
  Theme,
  DeliberationSession,
  AdvisorPersona,
  ApiKeyConfig,
  InvoiceRecord,
  ModelProvider,
} from '../types';
import {
  initialSessions,
  initialPersonas,
  initialApiKeys,
  initialInvoices,
} from '../data/mockData';
import { translations } from '../i18n';

interface AppContextType {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  toggleTheme: () => void;
  t: typeof translations.en;

  // Sessions
  sessions: DeliberationSession[];
  currentSessionId: string;
  setCurrentSessionId: (id: string) => void;
  currentSession: DeliberationSession;
  startNewSession: (question?: string, framework?: DeliberationSession['framework']) => void;
  setCurrentFramework: (framework: DeliberationSession['framework']) => void;
  purgeSessions: () => void;

  // Personas
  personas: AdvisorPersona[];
  addPersona: (persona: AdvisorPersona) => void;

  // API Keys
  apiKeys: ApiKeyConfig[];
  connectApiKey: (provider: ModelProvider) => void;
  removeApiKey: (provider: ModelProvider) => void;
  revokeAllKeys: () => void;

  // Invoices & Billing
  invoices: InvoiceRecord[];

  // Checkout & Discounts
  isCheckoutDrawerOpen: boolean;
  openCheckoutDrawer: () => void;
  closeCheckoutDrawer: () => void;
  discountCode: string;
  discountApplied: boolean;
  discountAmount: number;
  applyDiscount: (code: string) => boolean;
  removeDiscount: () => void;
  finalPrice: number;

  // Modals
  isFrameworkModalOpen: boolean;
  openFrameworkModal: () => void;
  closeFrameworkModal: () => void;
  isCounterDraftModalOpen: boolean;
  openCounterDraftModal: () => void;
  closeCounterDraftModal: () => void;

  // Toast notifications
  toastMessage: string | null;
  showToast: (message: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('dark');
  const [sessions, setSessions] = useState<DeliberationSession[]>(initialSessions);
  const [currentSessionId, setCurrentSessionId] = useState<string>('remote-job-flexibility');
  const [personas, setPersonas] = useState<AdvisorPersona[]>(initialPersonas);
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig[]>(initialApiKeys);
  const [invoices] = useState<InvoiceRecord[]>(initialInvoices);

  // Modals & Drawer
  const [isCheckoutDrawerOpen, setIsCheckoutDrawerOpen] = useState(false);
  const [isFrameworkModalOpen, setIsFrameworkModalOpen] = useState(false);
  const [isCounterDraftModalOpen, setIsCounterDraftModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Discount
  const [discountCode, setDiscountCode] = useState('COUNCIL30');
  const [discountApplied, setDiscountApplied] = useState(true);
  const discountAmount = 30000;
  const basePrice = 149000;
  const finalPrice = discountApplied ? basePrice - discountAmount : basePrice;

  // Theme synchronization with html tag
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const openCheckoutDrawer = () => setIsCheckoutDrawerOpen(true);
  const closeCheckoutDrawer = () => setIsCheckoutDrawerOpen(false);

  const openFrameworkModal = () => setIsFrameworkModalOpen(true);
  const closeFrameworkModal = () => setIsFrameworkModalOpen(false);

  const openCounterDraftModal = () => setIsCounterDraftModalOpen(true);
  const closeCounterDraftModal = () => setIsCounterDraftModalOpen(false);

  const applyDiscount = (code: string) => {
    if (code.trim().toUpperCase() === 'COUNCIL30') {
      setDiscountCode('COUNCIL30');
      setDiscountApplied(true);
      showToast(language === 'vi' ? 'Đã áp dụng mã giảm giá COUNCIL30' : 'Code COUNCIL30 applied (−₫30,000)');
      return true;
    }
    setDiscountApplied(false);
    return false;
  };

  const removeDiscount = () => {
    setDiscountApplied(false);
    setDiscountCode('');
    showToast(language === 'vi' ? 'Đã xóa mã khuyến mại' : 'Promotion code removed');
  };

  const addPersona = (newPersona: AdvisorPersona) => {
    setPersonas((prev) => [newPersona, ...prev]);
    showToast(language === 'vi' ? `Đã thêm persona mẫu ${newPersona.name}` : `Added sample persona ${newPersona.name}`);
    setCurrentView('personas');
  };

  const connectApiKey = (provider: ModelProvider) => {
    setApiKeys((prev) =>
      prev.map((item) => (item.provider === provider ? { ...item, connected: true } : item))
    );
    showToast(
      language === 'vi'
        ? `Mô phỏng khóa cho ${provider}; không có khóa nào được lưu hoặc gửi đi`
        : `Mock key connected for ${provider}; no key was stored or sent`
    );
  };

  const removeApiKey = (provider: ModelProvider) => {
    setApiKeys((prev) =>
      prev.map((item) =>
        item.provider === provider ? { ...item, connected: false, maskedKey: undefined } : item
      )
    );
    showToast(language === 'vi' ? `Đã xóa trạng thái mô phỏng của ${provider}` : `Cleared mock state for ${provider}`);
  };

  const revokeAllKeys = () => {
    setApiKeys((prev) => prev.map((k) => ({ ...k, connected: false, maskedKey: undefined })));
    showToast(
      language === 'vi' ? 'Đã gỡ trạng thái khóa mô phỏng' : 'All mock key states cleared'
    );
  };

  const purgeSessions = () => {
    setSessions([]);
    showToast(language === 'vi' ? 'Đã xóa toàn bộ phiên mẫu' : 'All mock sessions reset');
    setCurrentView('empty-chamber');
  };

  const startNewSession = (
    question: string = 'Should I accept a remote job offer that pays less but gives more flexibility?',
    framework: DeliberationSession['framework'] = 'Good / Normal / Bad Scenarios'
  ) => {
    const existing = sessions.find((s) => s.title.toLowerCase() === question.toLowerCase());
    if (existing) {
      setCurrentSessionId(existing.id);
      setCurrentView('session-active');
      return;
    }

    const newId = `session-${Date.now()}`;
    const newSession: DeliberationSession = {
      id: newId,
      title: question,
      summary: 'Mock deliberation preview in progress; no model is running.',
      framework,
      timestamp: new Date().toISOString(),
      relativeTime: 'Just now',
      status: 'Deliberating',
      voteCount: 3,
      voteSummary: 'Sample consensus in progress',
      referenceCode: `D-${Math.floor(800 + Math.random() * 100)}`,
      advisors: personas,
      baselineMetrics: {
        baselineCashflow: 'Current Situation',
        baseAdjustment: 'Variable Variance',
        locationModel: 'Flexible Model',
        commuteRecovery: '+15-20 hrs/mo',
      },
      testimonies: [
        {
          advisorId: 'pragmatist',
          heading: 'The Pragmatist',
          stanceBadge: 'Conditional Proceed',
          primaryText:
            'When evaluating this decision, real spendable variance and operational runway must take precedence. Net savings on transport, meals, and friction recuperate substantial capital.',
          secondaryText:
            'Accounting for tax brackets, the authentic net impact is lower than nominal figures suggest. Labor value increases if reclaimed hours are used intentionally.',
          metricLabel: 'Solvency Horizon',
          metricValue: 'Net liquidity neutral within 90 days',
        },
        {
          advisorId: 'dreamer',
          heading: 'The Dreamer',
          stanceBadge: 'Strong Support',
          primaryText:
            'Autonomy is the primary multiplier of cognitive clarity and longevity. The hours reclaimed per month represent hundreds of annual sovereign hours.',
          secondaryText:
            'Eliminating surveillance friction directly improves vitality, providing space for high-upside compounding and meaningful life balance.',
          metricLabel: 'Autonomy Dividend',
          metricValue: 'Six work-weeks equivalent per annum',
        },
        {
          advisorId: 'skeptic',
          heading: 'The Skeptic',
          stanceBadge: 'Caution & Counter-propose',
          primaryText:
            'Structures with less oversight introduce informational asymmetry and potential promotional ceilings if governance is lacking.',
          secondaryText:
            'Lock in concrete milestone reviews and formalized allowances to prevent unpaid availability creep and salary anchoring.',
          metricLabel: 'Vulnerability Exposure',
          metricValue: 'Proximity bias & salary anchoring risk',
        },
      ],
      synthesis: {
        chairTitle: 'The Chair',
        chairRole: 'Sample Executive Synthesis & Deliberative Convergence',
        statusBadge: 'Sample Consensus',
        coreRecommendation:
          'Accept offer conditionally. Establish explicit milestone benchmarks and request standard setup compensation.',
        stipulations: [
          'Formal salary review at 6 months pegged to milestone delivery',
          'One-time $2,500 home studio and equipment stipend',
        ],
        tradeOffCalculus: {
          grossDeficit: '-15.0%',
          effectiveLaborRate: '+4.8%',
          reclaimedHours: '240 hrs',
        },
        nextAction: 'Dispatch structured counter-proposal email emphasizing remote execution benchmarks.',
        quote:
          'The trade is mathematically defensible and psychologically asymmetric in your favor, provided you refuse to absorb organizational opacity as a passive observer.',
      },
      scenarios: {
        good: {
          title: 'Good Scenario: Accelerated Growth & Autonomy',
          subtitle: 'High Compounding',
          description: 'Saved hours convert to high-leverage personal development while autonomy remains part of the sample scenario.',
          actions: ['Validation checkpoint at month 3', 'Negotiate advisory equity terms'],
        },
        normal: {
          title: 'Normal Scenario: Stable Equilibrium',
          subtitle: 'Stable Equilibrium',
          description: 'Cost of living reductions absorb pay variance with noticeable improvements in personal health.',
          actions: ['Semi-annual performance reviews', 'Protect dedicated study hours'],
        },
        bad: {
          title: 'Bad Scenario: Boundary Erosion',
          subtitle: 'Boundary Erosion',
          description: 'Proximity bias limits executive visibility and work expands into evening hours.',
          actions: ['Require 6-month liquid reserve buffer', 'Define clear 90-day review triggers'],
        },
      },
    };

    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setCurrentView('session-active');
  };

  const setCurrentFramework = (framework: DeliberationSession['framework']) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === currentSessionId ? { ...session, framework } : session
      )
    );
  };

  const currentSession =
    sessions.find((s) => s.id === currentSessionId) || sessions[0] || initialSessions[0];

  const t = translations[language];

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        language,
        setLanguage,
        theme,
        toggleTheme,
        t,
        sessions,
        currentSessionId,
        setCurrentSessionId,
        currentSession,
        startNewSession,
        setCurrentFramework,
        purgeSessions,
        personas,
        addPersona,
        apiKeys,
        connectApiKey,
        removeApiKey,
        revokeAllKeys,
        invoices,
        isCheckoutDrawerOpen,
        openCheckoutDrawer,
        closeCheckoutDrawer,
        discountCode,
        discountApplied,
        discountAmount,
        applyDiscount,
        removeDiscount,
        finalPrice,
        isFrameworkModalOpen,
        openFrameworkModal,
        closeFrameworkModal,
        isCounterDraftModalOpen,
        openCounterDraftModal,
        closeCounterDraftModal,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
