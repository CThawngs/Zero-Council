import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, ShieldCheck, Clock, Tag } from 'lucide-react';

export const CheckoutDrawer: React.FC = () => {
  const {
    isCheckoutDrawerOpen,
    closeCheckoutDrawer,
    discountCode,
    discountApplied,
    discountAmount,
    applyDiscount,
    removeDiscount,
    finalPrice,
    showToast,
    language,
    setCurrentView,
  } = useApp();

  const [inputCode, setInputCode] = useState(discountCode);
  const [secondsLeft, setSecondsLeft] = useState(895); // ~15 mins countdown
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!isCheckoutDrawerOpen) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isCheckoutDrawerOpen]);

  if (!isCheckoutDrawerOpen) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const success = applyDiscount(inputCode);
    if (!success) {
      showToast(language === 'vi' ? 'Mã ưu đãi không hợp lệ' : 'Invalid promotional code');
    }
  };

  const handleConfirmPayment = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      closeCheckoutDrawer();
      showToast(
        language === 'vi'
          ? 'Mô phỏng hoàn tất; không có giao dịch hoặc kích hoạt thật.'
          : 'Demo completed; no payment or plan was activated.'
      );
      setCurrentView('billing-history');
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-surface border-l border-border shadow-2xl flex flex-col">
          {/* Drawer Header */}
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-brass" />
              <h3 className="font-serif text-lg text-ink font-normal">
                {language === 'vi' ? 'Thanh toán minh họa — không chuyển tiền' : 'Illustrative checkout — do not transfer'}
              </h3>
            </div>
            <button
              onClick={closeCheckoutDrawer}
              className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-background transition-colors"
              type="button"
            >
              <X className="w-4 h-4" />
              <span className="sr-only">Close illustrative checkout</span>
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div
              role="alert"
              className="rounded-md border-2 border-terracotta bg-terracotta/10 p-4 text-center text-sm font-semibold text-terracotta"
            >
              SAMPLE ONLY — DO NOT TRANSFER MONEY
            </div>

            {/* Countdown Alert */}
            <div className="p-3 rounded-md bg-background border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-ink-muted">
                <Clock className="w-3.5 h-3.5 text-brass" />
                <span>Sample preview timer</span>
              </div>
              <span className="font-mono text-brass font-medium">{timeFormatted}</span>
            </div>

            {/* Plan & Pricing Summary */}
            <div className="p-4 rounded-md bg-background/60 border border-border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink font-medium">Sovereign Pro Chamber</span>
                <span className="text-ink-muted">Monthly access</span>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-border text-xs">
                <div className="flex justify-between text-ink-muted">
                  <span>Standard Price</span>
                  <span>₫149,000</span>
                </div>
                {discountApplied && (
                  <div className="flex justify-between text-sage">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Promo Code (COUNCIL30)
                    </span>
                    <span>-₫{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 border-t border-border text-sm font-medium text-ink">
                  <span>Total Amount</span>
                  <span className="font-serif text-lg text-brass">
                    ₫{finalPrice.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Voucher Input */}
            <form onSubmit={handleApplyCoupon} className="space-y-2">
              <label htmlFor="promo-code" className="block text-xs font-medium text-ink-muted">
                Promotional Voucher
              </label>
              <div className="flex gap-2">
                <input
                  id="promo-code"
                  name="promo-code"
                  type="text"
                  value={inputCode}
                  autoComplete="off"
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="Enter COUNCIL30"
                  className="flex-1 px-3 py-2 text-xs bg-background border border-border rounded-md text-ink placeholder:text-ink-muted/50 uppercase font-mono focus:outline-none focus:border-brass"
                />
                {discountApplied ? (
                  <button
                    type="button"
                    onClick={removeDiscount}
                    className="px-3 py-2 text-xs font-medium text-terracotta border border-border hover:bg-background rounded-md transition-colors"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="px-3 py-2 text-xs font-medium text-ink bg-surface border border-border hover:bg-background rounded-md transition-colors"
                  >
                    Apply
                  </button>
                )}
              </div>
            </form>

            {/* Illustrative checkout preview */}
            <div className="relative p-5 rounded-md bg-background border border-border flex flex-col items-center text-center overflow-hidden">
              <div className="p-3 bg-white rounded-md border border-neutral-300 shadow-xs mb-3 relative" aria-hidden="true">
                <svg
                  width="160"
                  height="160"
                  viewBox="0 0 100 100"
                  className="w-40 h-40"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="100" height="100" fill="#FFFFFF" />
                  <rect x="6" y="6" width="24" height="24" fill="#141722" />
                  <rect x="10" y="10" width="16" height="16" fill="#FFFFFF" />
                  <rect x="14" y="14" width="8" height="8" fill="#141722" />
                  <rect x="70" y="6" width="24" height="24" fill="#141722" />
                  <rect x="74" y="10" width="16" height="16" fill="#FFFFFF" />
                  <rect x="78" y="14" width="8" height="8" fill="#141722" />
                  <rect x="6" y="70" width="24" height="24" fill="#141722" />
                  <rect x="10" y="74" width="16" height="16" fill="#FFFFFF" />
                  <rect x="14" y="78" width="8" height="8" fill="#141722" />
                  <rect x="36" y="10" width="6" height="18" fill="#141722" />
                  <rect x="46" y="6" width="6" height="6" fill="#141722" />
                  <rect x="56" y="16" width="6" height="12" fill="#141722" />
                  <rect x="36" y="36" width="26" height="26" fill="#141722" rx="4" />
                  <circle cx="49" cy="49" r="6" fill="#C9A24B" />
                  <rect x="6" y="36" width="12" height="6" fill="#141722" />
                  <rect x="22" y="44" width="6" height="14" fill="#141722" />
                  <rect x="70" y="36" width="14" height="6" fill="#141722" />
                  <rect x="78" y="48" width="16" height="6" fill="#141722" />
                  <rect x="36" y="70" width="8" height="24" fill="#141722" />
                  <rect x="52" y="76" width="12" height="18" fill="#141722" />
                  <rect x="70" y="70" width="24" height="8" fill="#141722" />
                  <rect x="80" y="84" width="14" height="10" fill="#141722" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm font-bold text-terracotta uppercase">
                  Sample only
                </div>
              </div>
              <p className="text-xs text-ink font-medium">Illustrative payment concept</p>
              <p className="text-[11px] text-ink-muted mt-0.5">
                Decorative placeholder only. It contains no payment code, bank details, or connected rail.
              </p>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-5 border-t border-border bg-background/50 space-y-3">
            <button
              onClick={handleConfirmPayment}
              disabled={isVerifying}
              type="button"
              className="w-full py-2.5 rounded-md bg-brass hover:bg-brass/90 text-background font-medium text-xs transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
            >
              {isVerifying ? (
                <span>Simulating sample completion...</span>
              ) : (
                <span>Simulate sample completion</span>
              )}
            </button>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-sage" />
              <span>UI simulation only · no payment request, bank detail, or activation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
