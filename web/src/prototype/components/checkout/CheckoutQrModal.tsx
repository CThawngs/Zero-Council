/**
 * Step 2 & Step 3 PayOS VietQR payment modal and active-QR close confirmation dialog.
 */

import React from 'react';
import { AlertTriangle, Check, Clock, Copy, Loader2, Lock, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../Modal';
import { formatCountdown, type QrSession } from './types';

interface CheckoutQrModalProps {
  qr: QrSession | null;
  resolvedQrSrc: string;
  qrExpired: boolean;
  qrError: string | null;
  retryingQr: boolean;
  qrImgLoaded: boolean;
  qrImgError: boolean;
  copiedMemo: boolean;
  remaining: number;
  confirmCloseOpen: boolean;
  onBeforeClose: () => boolean;
  onForceClose: () => void;
  onRetryExpired: () => void;
  onCopyMemo: () => void;
  onImgLoad: () => void;
  onImgError: () => void;
  onCancelConfirmClose: () => void;
}

export const CheckoutQrModal: React.FC<CheckoutQrModalProps> = ({
  qr,
  resolvedQrSrc,
  qrExpired,
  qrError,
  retryingQr,
  qrImgLoaded,
  qrImgError,
  copiedMemo,
  remaining,
  confirmCloseOpen,
  onBeforeClose,
  onForceClose,
  onRetryExpired,
  onCopyMemo,
  onImgLoad,
  onImgError,
  onCancelConfirmClose,
}) => {
  const { t, language } = useApp();

  return (
    <>
      <Modal
        isOpen={qr !== null}
        onBeforeClose={onBeforeClose}
        onClose={onForceClose}
        title={qrExpired ? t.checkoutQrExpiredTitle : t.checkoutQrTitle}
        description={qrExpired ? undefined : t.checkoutQrBody}
        closeLabel={t.close}
      >
        {qr ? (
          <div className="flex flex-col items-center space-y-4">
            {qrExpired ? (
              <div
                id="qr-expired-state"
                role="status"
                className="flex w-full flex-col items-center space-y-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  <Clock className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-ink">{t.checkoutQrExpiredTitle}</h3>
                  <p className="text-sm leading-relaxed text-ink-muted">{t.checkoutQrExpired}</p>
                </div>

                {qrError ? (
                  <p role="alert" className="text-xs leading-relaxed text-terracotta">
                    {qrError}
                  </p>
                ) : null}

                <div className="flex w-full flex-col gap-2 pt-1 sm:flex-row">
                  <button
                    type="button"
                    id="qr-retry-pay-btn"
                    onClick={onRetryExpired}
                    disabled={retryingQr}
                    className="button-primary min-h-11 flex-1 justify-center disabled:opacity-60"
                  >
                    {retryingQr ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    )}
                    {t.checkoutQrPayAgain}
                  </button>
                  <button
                    type="button"
                    onClick={onForceClose}
                    className="button-secondary min-h-11 justify-center px-5"
                  >
                    {t.close}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {!resolvedQrSrc || qrImgError ? (
                  <div
                    role="alert"
                    className="flex w-full flex-col items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-center"
                  >
                    <AlertTriangle
                      className="h-6 w-6 text-amber-700 dark:text-amber-400"
                      aria-hidden="true"
                    />
                    <p className="text-xs leading-relaxed text-ink">
                      {t.checkoutQrImageUnavailable}
                    </p>
                    <button
                      type="button"
                      onClick={onRetryExpired}
                      disabled={retryingQr}
                      className="button-secondary min-h-10 px-4 text-xs"
                    >
                      {retryingQr ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {t.checkoutQrPayAgain}
                    </button>
                  </div>
                ) : (
                  <div className="relative flex h-52 w-52 items-center justify-center sm:h-60 sm:w-60">
                    {!qrImgLoaded ? (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 animate-pulse rounded-xl border border-border bg-surface-2"
                      />
                    ) : null}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      id="qr-code-image"
                      src={resolvedQrSrc}
                      alt={t.checkoutQrAlt.replace('{bill}', String(qr.orderCode))}
                      onLoad={onImgLoad}
                      onError={onImgError}
                      className="h-52 w-52 rounded-xl border border-border bg-white object-contain p-2 shadow-md sm:h-60 sm:w-60"
                    />
                  </div>
                )}

                <div className="grid w-full gap-3 sm:grid-cols-2">
                  <div className="field">
                    <label htmlFor="qr-plan" className="field-label flex items-center gap-1">
                      <Lock className="h-3 w-3 text-brass" aria-hidden="true" />
                      {t.checkoutQrPlan}
                    </label>
                    <input
                      id="qr-plan"
                      type="text"
                      disabled
                      readOnly
                      value={qr.planName}
                      className="cursor-not-allowed bg-surface-2 font-semibold text-ink opacity-75"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="qr-order-id" className="field-label flex items-center gap-1">
                      <Lock className="h-3 w-3 text-brass" aria-hidden="true" />
                      {t.checkoutQrOrderId}
                    </label>
                    <input
                      id="qr-order-id"
                      type="text"
                      disabled
                      readOnly
                      value={`#${qr.orderCode}`}
                      className="cursor-not-allowed bg-surface-2 font-mono text-ink opacity-75"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="qr-amount" className="field-label flex items-center gap-1">
                      <Lock className="h-3 w-3 text-brass" aria-hidden="true" />
                      {t.checkoutQrAmount}
                    </label>
                    <input
                      id="qr-amount"
                      type="text"
                      disabled
                      readOnly
                      value={
                        qr.couponPercent > 0
                          ? t.checkoutQrAmountDiscount
                              .replace(
                                '{amount}',
                                `${qr.amountVnd.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} ₫`
                              )
                              .replace('{percent}', String(qr.couponPercent))
                              .replace(
                                '{original}',
                                `${qr.originalAmountVnd.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} ₫`
                              )
                          : `${qr.amountVnd.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} ₫`
                      }
                      className="cursor-not-allowed bg-surface-2 font-semibold text-sage"
                    />
                  </div>

                  <div className="field">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="qr-bill" className="field-label flex items-center gap-1">
                        <Lock className="h-3 w-3 text-brass" aria-hidden="true" />
                        {t.checkoutQrBill}
                      </label>
                      <button
                        type="button"
                        id="qr-copy-memo-btn"
                        onClick={onCopyMemo}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-brass transition hover:bg-brass/10"
                      >
                        {copiedMemo ? (
                          <Check className="h-3 w-3 text-sage" aria-hidden="true" />
                        ) : (
                          <Copy className="h-3 w-3" aria-hidden="true" />
                        )}
                        <span>{copiedMemo ? t.copied : t.checkoutCopyOrderInfo}</span>
                      </button>
                    </div>
                    <input
                      id="qr-bill"
                      type="text"
                      disabled
                      readOnly
                      value={`ZC${String(qr.orderCode).slice(-7)}`}
                      className="cursor-not-allowed bg-surface-2 font-mono text-ink opacity-75"
                    />
                  </div>
                </div>

                <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-surface-2/80 px-4 py-2">
                  <span className="text-xs text-ink-muted">{t.checkoutQrRemainingLabel}</span>
                  <p
                    role="timer"
                    className="font-serif text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400"
                  >
                    {formatCountdown(remaining)}
                  </p>
                </div>

                <div className="flex items-center gap-2 py-1 text-center text-xs text-sage">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sage" aria-hidden="true" />
                  <span>{t.checkoutQrAutoTracking}</span>
                </div>

                <p className="text-center text-xs leading-relaxed text-ink-muted">
                  {t.checkoutQrCancelHint}
                </p>
              </>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={confirmCloseOpen}
        onClose={onCancelConfirmClose}
        title={t.checkoutQrConfirmCloseTitle}
        closeLabel={t.close}
        footer={
          <>
            <button
              type="button"
              id="qr-confirm-keep-btn"
              onClick={onCancelConfirmClose}
              className="button-secondary min-h-11 justify-center"
            >
              {t.checkoutQrConfirmKeep}
            </button>
            <button
              type="button"
              id="qr-confirm-discard-btn"
              onClick={onForceClose}
              className="button-danger min-h-11 justify-center"
            >
              {t.checkoutQrConfirmDiscard}
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400"
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-ink-muted">
            {t.checkoutQrConfirmCloseBody}
          </p>
        </div>
      </Modal>
    </>
  );
};
