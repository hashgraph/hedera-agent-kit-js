'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';

const COMMON_ERRORS = [
  {
    title: 'HashPack: "No applicable accounts"',
    cause:
      'The connected wallet does not hold an account matching the requested network (e.g. testnet vs mainnet) or the account key does not match the active session.',
    solution:
      'Verify that your HashPack network is set to "Testnet" and that the account selected in the wallet has testnet HBAR. Re-pair the WalletConnect session if needed.',
  },
  {
    title: 'Wallet Signing: "list is locked"',
    cause:
      'The transaction list was already submitted or frozen by another signer or the WalletConnect provider is waiting for an earlier pending signing request.',
    solution:
      'Refresh the page and re-initiate the 402 payment challenge. In RETURN_BYTES mode, discard cached bytes on rejection before preparing a new transaction.',
  },
  {
    title: 'x402 Settlement: "TOKEN_NOT_ASSOCIATED_TO_ACCOUNT"',
    cause:
      'Hedera requires explicit token association before an account can receive HTS fungible or non-fungible tokens (such as USDC). If the payer or receiver account is not associated, transfer fails.',
    solution:
      'Associate the token ID (e.g. 0.0.429274 for Testnet USDC) with both the payer and receiver accounts via TokenAssociateTransaction, or set maxAutomaticTokenAssociations > 0.',
  },
  {
    title: 'Browser/API: "The provided x402 payment could not be verified."',
    cause:
      'The partially signed transaction payload does not match the payment requirements (wrong recipient, insufficient tinybars, wrong network, or missing fee payer signature).',
    solution:
      'Ensure the client signs the exact amount and recipient returned in the 402 challenge. Verify that extra.feePayer is set and that the facilitator key matches the fee payer account.',
  },
];

const PREFLIGHT_ITEMS = [
  'Operator account is funded on testnet',
  'Wallet account is funded on testnet',
  'Receiver account is associated with the payment token',
  'Payer account holds the payment token',
  'Correct testnet/mainnet config is set',
  'All required environment variables are present and valid',
  'Valid fee payer is configured',
  'WalletConnect session is active and connected to the correct network',
];

export function TroubleshootingCard() {
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [expandedError, setExpandedError] = useState<number | null>(null);

  const toggleCheck = (idx: number) => {
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const completedCount = Object.values(checkedItems).filter(Boolean).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-2">
          <HelpCircle className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold tracking-wide">
            Troubleshooting & Pre-flight Checklist
          </h2>
        </div>
        <span className="text-xs bg-indigo-950 text-indigo-300 px-3 py-1 rounded-full border border-indigo-800">
          {completedCount} / {PREFLIGHT_ITEMS.length} Checked
        </span>
      </div>

      {/* Pre-flight Checklist */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
          Pre-flight Checklist
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {PREFLIGHT_ITEMS.map((item, idx) => {
            const isChecked = Boolean(checkedItems[idx]);
            return (
              <label
                key={idx}
                onClick={() => toggleCheck(idx)}
                className={`flex items-center space-x-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  isChecked
                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border ${
                    isChecked ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-slate-600'
                  }`}
                >
                  {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
                <span>{item}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Errors Seen in the Wild */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span>Errors Seen in the Wild & Solutions</span>
        </h3>
        <div className="space-y-2">
          {COMMON_ERRORS.map((err, idx) => {
            const isExpanded = expandedError === idx;
            return (
              <div
                key={idx}
                className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/60 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setExpandedError(isExpanded ? null : idx)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-800/30"
                >
                  <span className="font-mono text-xs text-amber-300 font-medium">{err.title}</span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                {isExpanded && (
                  <div className="p-3.5 border-t border-slate-800/80 text-xs space-y-2 bg-slate-900/80">
                    <div>
                      <strong className="text-slate-400">Root Cause:</strong>{' '}
                      <span className="text-slate-300">{err.cause}</span>
                    </div>
                    <div>
                      <strong className="text-emerald-400">Resolution:</strong>{' '}
                      <span className="text-emerald-200">{err.solution}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
