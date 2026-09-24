import React from 'react';
import { useApp } from '../context/AppContext';
import { FileDown, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const BillingHistoryView: React.FC = () => {
  const { invoices, setCurrentView, showToast, language } = useApp();

  const handleDownloadReceipt = (code: string) => {
    showToast(
      language === 'vi'
        ? `Mô phỏng biên lai: ${code}; không có tệp hoặc giao dịch thật`
        : `Mock receipt ${code}; no file or real transaction exists`
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6 text-left">
      {/* Back button */}
      <button
        onClick={() => setCurrentView('settings')}
        type="button"
        className="text-xs text-ink-muted hover:text-ink transition-colors flex items-center gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Settings</span>
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brass" />
          <span className="text-xs font-mono text-brass font-medium">Mock Billing Ledger</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl text-ink font-normal mt-1">
          Sample Billing Records
        </h1>
        <p className="text-xs text-ink-muted">
          Sample records only. No PayOS, VietQR, invoice, payment, or webhook service is connected.
        </p>
      </div>

      {/* Invoices Table Card */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-background/50 text-ink-muted font-medium">
                <th className="p-4">Sample Date</th>
                <th className="p-4">Mock Reference</th>
                <th className="p-4">Plan Tier</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-ink">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-background/30 transition-colors">
                  <td className="p-4">
                    <p className="font-medium text-ink">{inv.date}</p>
                    <p className="text-[11px] text-ink-muted">{inv.clearingTime}</p>
                  </td>
                  <td className="p-4 font-mono text-xs text-brass">{inv.receiptCode}</td>
                  <td className="p-4 text-ink-muted">{inv.plan}</td>
                  <td className="p-4 font-mono font-medium">₫{inv.amount.toLocaleString()}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border border-sage/40 text-sage text-[11px] font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{inv.status}</span>
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDownloadReceipt(inv.receiptCode)}
                      className="p-1.5 rounded-md border border-border hover:bg-background text-ink-muted hover:text-ink transition-colors inline-flex items-center gap-1"
                      title="Simulate receipt download"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span className="text-[11px] hidden sm:inline">Mock PDF</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
