'use client';

import React, { useState } from 'react';
import {
  Wallet,
  ShieldCheck,
  Send,
  Coins,
  ExternalLink,
  ArrowRight,
  CheckCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import type { PaymentRequirements } from '@x402/core/types';

export function PaymentDemo() {
  const [accountId, setAccountId] = useState('0.0.1001');
  const [selectedAction, setSelectedAction] = useState<
    'submit_topic_message' | 'mint_fungible_token'
  >('submit_topic_message');
  const [topicMessage, setTopicMessage] = useState('Hello Hedera Agent Kit + x402!');
  const [tokenAmount, setTokenAmount] = useState(10);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [challengeData, setChallengeData] = useState<any>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [resultData, setResultData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 2 & 3: Request Challenge (HTTP 402)
  const handleTriggerAction = async () => {
    setErrorMessage(null);
    setResultData(null);
    setChallengeData(null);
    setCurrentStep(2);

    try {
      const res = await fetch(`/api/x402/challenge?action=${selectedAction}`);
      const data = await res.json();

      if (res.status === 402) {
        setChallengeData(data);
        setCurrentStep(3);
      } else {
        throw new Error(data.message || 'Expected 402 challenge');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  // Step 4 & 5 & 6: Sign & Settle & Execute Tool
  const handleSignAndSettle = async () => {
    if (!challengeData) return;
    setErrorMessage(null);
    setIsSigning(true);
    setCurrentStep(4);

    try {
      const requirements: PaymentRequirements = challengeData.paymentRequirements;

      // In browser demo, we construct the transaction payload signed by user
      // or request signature via WalletConnect adapter
      const dummySignedTxBase64 = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: requirements.network,
          payTo: requirements.payTo,
          amount: requirements.amount,
          asset: requirements.asset,
          payer: accountId,
          timestamp: Date.now(),
        }),
      ).toString('base64');

      setIsSigning(false);
      setIsSettling(true);
      setCurrentStep(5);

      const settleRes = await fetch('/api/x402/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': dummySignedTxBase64,
        },
        body: JSON.stringify({
          action: selectedAction,
          paymentPayload: dummySignedTxBase64,
          userAccountId: accountId,
          message: topicMessage,
          amount: tokenAmount,
        }),
      });

      const settleData = await settleRes.json();
      if (!settleRes.ok || !settleData.success) {
        throw new Error(settleData.error || 'Payment verification or settlement failed');
      }

      setCurrentStep(6);
      setResultData(settleData);
      setCurrentStep(7);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSigning(false);
      setIsSettling(false);
    }
  };

  const resetFlow = () => {
    setCurrentStep(1);
    setChallengeData(null);
    setResultData(null);
    setErrorMessage(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-xl space-y-6">
      {/* Step Tracker Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center space-x-2 text-white mb-2">
          <span>Hedera Agent Kit + x402 End-to-End Flow</span>
        </h2>
        <p className="text-xs text-slate-400">
          Walk through the 7 steps: Connect → Action → 402 Challenge → Wallet Sign → Settle → Tool
          Execution → HashScan
        </p>

        {/* 7-Step Visual Progress Bar */}
        <div className="grid grid-cols-7 gap-1 mt-4 text-[10px] text-center font-medium">
          {[
            '1. Connect',
            '2. Action',
            '3. 402 Challenge',
            '4. Sign Payment',
            '5. Settle',
            '6. Agent Tool',
            '7. HashScan Links',
          ].map((stepName, i) => {
            const stepNum = i + 1;
            const isDone = currentStep > stepNum;
            const isCurrent = currentStep === stepNum;
            return (
              <div
                key={i}
                className={`p-2 rounded border transition-all ${
                  isDone
                    ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                    : isCurrent
                      ? 'bg-indigo-900/80 border-indigo-500 text-indigo-200 ring-2 ring-indigo-500/40'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                }`}
              >
                {stepName}
              </div>
            );
          })}
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-xs text-rose-300">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {/* Step 1: Wallet Connection */}
      <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-semibold text-slate-200">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>Step 1: Hedera Testnet Wallet</span>
          </div>
          <span className="text-xs bg-emerald-950 text-emerald-400 px-2.5 py-0.5 rounded border border-emerald-800 font-mono">
            Connected (Testnet)
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <label className="text-xs text-slate-400 whitespace-nowrap">Account ID:</label>
          <input
            type="text"
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 font-mono flex-1 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Step 2: Trigger Action Selection */}
      <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/40 space-y-3">
        <div className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
          <Lock className="w-4 h-4 text-amber-400" />
          <span>Step 2: Trigger an Action that Requires Payment</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelectedAction('submit_topic_message')}
            className={`p-3 rounded-lg border text-left text-xs transition-all ${
              selectedAction === 'submit_topic_message'
                ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="font-semibold text-white flex items-center justify-between mb-1">
              <span>HCS Topic Message</span>
              <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 font-mono">
                0.01 HBAR
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Calls <code>submit_topic_message_tool</code> after settlement.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedAction('mint_fungible_token')}
            className={`p-3 rounded-lg border text-left text-xs transition-all ${
              selectedAction === 'mint_fungible_token'
                ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="font-semibold text-white flex items-center justify-between mb-1">
              <span>HTS Token Mint</span>
              <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 font-mono">
                0.05 HBAR
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Calls <code>mint_fungible_token_tool</code> after settlement.
            </div>
          </button>
        </div>

        {selectedAction === 'submit_topic_message' ? (
          <div>
            <label className="text-xs text-slate-400 block mb-1">Message Content to Submit:</label>
            <input
              type="text"
              value={topicMessage}
              onChange={e => setTopicMessage(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        ) : (
          <div>
            <label className="text-xs text-slate-400 block mb-1">Tokens to Mint:</label>
            <input
              type="number"
              value={tokenAmount}
              onChange={e => setTokenAmount(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleTriggerAction}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg text-xs flex items-center justify-center space-x-2 transition-colors"
        >
          <span>Trigger Protected Action</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Step 3: 402 Challenge Preview */}
      {challengeData && (
        <div className="border border-indigo-900/80 bg-indigo-950/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
            <span className="flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Step 3: Server Returns HTTP 402 Payment Required</span>
            </span>
            <span className="bg-indigo-900 px-2 py-0.5 rounded text-[10px] font-mono text-indigo-200">
              Status 402
            </span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded p-3 text-[11px] font-mono text-slate-300 space-y-1">
            <div>
              <span className="text-slate-500">PayTo:</span>{' '}
              <span className="text-emerald-400">{challengeData.paymentRequirements?.payTo}</span>
            </div>
            <div>
              <span className="text-slate-500">Amount:</span>{' '}
              <span className="text-amber-300">
                {challengeData.paymentRequirements?.amount} tinybars
              </span>
            </div>
            <div>
              <span className="text-slate-500">Network:</span>{' '}
              <span>{challengeData.paymentRequirements?.network}</span>
            </div>
            <div>
              <span className="text-slate-500">Fee Payer:</span>{' '}
              <span>{challengeData.paymentRequirements?.extra?.feePayer}</span>
            </div>
          </div>

          {currentStep <= 4 && (
            <button
              type="button"
              disabled={isSigning || isSettling}
              onClick={handleSignAndSettle}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg text-xs flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
            >
              {isSigning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Step 4: Signing Hedera Payment in Wallet...</span>
                </>
              ) : isSettling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Step 5: Verifying & Settling Payment on Testnet...</span>
                </>
              ) : (
                <>
                  <Coins className="w-3.5 h-3.5" />
                  <span>Step 4 & 5: Sign & Settle x402 Payment</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Step 6 & 7: Results & HashScan Links */}
      {resultData && (
        <div className="border border-emerald-800/80 bg-emerald-950/30 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
            <span className="flex items-center space-x-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Step 6 & 7: Tool Executed! HashScan Links Ready</span>
            </span>
            <span className="bg-emerald-900 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-200">
              SUCCESS
            </span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded p-3 text-xs space-y-2">
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Generated HashScan Links:
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Payment Transaction:</span>
                <a
                  href={resultData.toolExecution?.hashscanLinks?.payment}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline flex items-center space-x-1 text-[11px]"
                >
                  <span>View on HashScan</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Tool Action Tx:</span>
                <a
                  href={resultData.toolExecution?.hashscanLinks?.actionTx}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline flex items-center space-x-1 text-[11px]"
                >
                  <span>View on HashScan</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Account:</span>
                <a
                  href={resultData.toolExecution?.hashscanLinks?.account}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline flex items-center space-x-1 text-[11px]"
                >
                  <span>View on HashScan</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {resultData.toolExecution?.hashscanLinks?.topicOrToken && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">HCS Topic / HTS Token:</span>
                  <a
                    href={resultData.toolExecution?.hashscanLinks?.topicOrToken}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:underline flex items-center space-x-1 text-[11px]"
                  >
                    <span>View on HashScan</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={resetFlow}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-1.5 rounded text-xs transition-colors"
          >
            Run Another Action
          </button>
        </div>
      )}
    </div>
  );
}
