import React, { useState } from 'react';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 rounded-full bg-[#0071E3] dark:bg-[#0A84FF] text-white text-xs font-semibold hover:bg-[#0077ED] dark:hover:bg-[#3399FF] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Install</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-full bg-[#0071E3] dark:bg-[#0A84FF] text-white hover:bg-[#0077ED] dark:hover:bg-[#3399FF] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{isIOS ? 'Add to iPhone' : 'iPhone App'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] p-6 pb-8 sm:pb-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-black/15 dark:bg-white/20 mx-auto mb-4 sm:hidden" />

            <div className="flex items-start justify-between gap-4 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                  Home Screen Web App
                </p>
                <h3
                  id="ios-install-title"
                  className="text-xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5"
                >
                  Add Caderno Lisboa to iPhone
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install instructions"
                className="min-w-[40px] min-h-[40px] rounded-full bg-black/[0.05] dark:bg-white/[0.08] flex items-center justify-center text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="mt-5 space-y-4 text-sm text-[#1D1D1F] dark:text-[#F5F5F7]">
              <li className="flex items-start gap-3.5">
                <span className="w-6 h-6 rounded-full bg-[#0071E3]/10 dark:bg-[#0A84FF]/15 text-[#0071E3] dark:text-[#0A84FF] text-xs font-semibold flex items-center justify-center shrink-0">
                  1
                </span>
                <span className="pt-0.5">
                  Open this page in <strong>Safari</strong> on your iPhone.
                </span>
              </li>
              <li className="flex items-start gap-3.5">
                <span className="w-6 h-6 rounded-full bg-[#0071E3]/10 dark:bg-[#0A84FF]/15 text-[#0071E3] dark:text-[#0A84FF] text-xs font-semibold flex items-center justify-center shrink-0">
                  2
                </span>
                <span className="pt-0.5 flex items-center flex-wrap gap-1.5">
                  Tap the <strong>Share</strong> button
                  <Share className="w-4 h-4 inline text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                  in Safari&apos;s toolbar.
                </span>
              </li>
              <li className="flex items-start gap-3.5">
                <span className="w-6 h-6 rounded-full bg-[#0071E3]/10 dark:bg-[#0A84FF]/15 text-[#0071E3] dark:text-[#0A84FF] text-xs font-semibold flex items-center justify-center shrink-0">
                  3
                </span>
                <span className="pt-0.5 flex items-center flex-wrap gap-1.5">
                  Choose <strong>Add to Home Screen</strong>
                  <PlusSquare className="w-4 h-4 inline text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                  then tap <strong>Add</strong>.
                </span>
              </li>
            </ol>

            <p className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] text-xs text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
              Your saved spots, Portuguese survival phrases, and checklists stay available offline even inside Lisbon metro tunnels.
            </p>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full min-h-[46px] rounded-xl bg-[#0071E3] dark:bg-[#0A84FF] text-white text-sm font-semibold hover:bg-[#0077ED] dark:hover:bg-[#3399FF] transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
