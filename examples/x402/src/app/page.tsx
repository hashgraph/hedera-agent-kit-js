import React from 'react';
import { PaymentDemo } from '@/components/PaymentDemo';
import { TroubleshootingCard } from '@/components/TroubleshootingCard';
import { Terminal, Cpu, BookOpen, Layers } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-slate-800 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400 bg-clip-text text-transparent">
              Hedera Agent Kit + x402 Payments
            </h1>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800 px-2.5 py-1 rounded-full">
                @hashgraph/hedera-agent-kit
              </span>
              <span className="text-[11px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded-full">
                @x402/hedera 2.30.0
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-400 max-w-3xl">
            Reference implementation demonstrating end-to-end HTTP 402 micropayments with Hedera
            Agent Kit, the x402-gated Model Context Protocol (MCP) server pattern, and async ReAct
            agent loops.
          </p>
        </div>

        {/* Primary Interactive Demo: Steps 1-7 */}
        <section>
          <PaymentDemo />
        </section>

        {/* Architectural Overview Panels */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5 space-y-3">
            <div className="flex items-center space-x-2 text-indigo-300 font-semibold text-sm">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <h3>Extended Scope: x402 + MCP Server Pattern</h3>
            </div>
            <p className="text-xs text-slate-400">
              Run a payment-gated MCP HTTP server where tool execution (e.g.{' '}
              <code>submit_topic_message_tool</code>) is blocked until confirmed HBAR/USDC
              micropayments are verified.
            </p>
            <div className="bg-slate-950 rounded-lg p-3 font-mono text-[11px] text-slate-300 border border-slate-800">
              <code>npm run start:mcp</code>
              <div className="text-slate-500 text-[10px] mt-1">
                src/mcp/x402-gated-mcp-server.ts
              </div>
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5 space-y-3">
            <div className="flex items-center space-x-2 text-emerald-300 font-semibold text-sm">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3>Async ReAct Agent Callbacks</h3>
            </div>
            <p className="text-xs text-slate-400">
              Demonstrates an async LangGraph/ReAct agent loop that pauses when encountering a
              payment-gated tool, yields a settlement callback, and resumes with verified receipt
              context.
            </p>
            <div className="bg-slate-950 rounded-lg p-3 font-mono text-[11px] text-slate-300 border border-slate-800">
              <code>npm run start:agent</code>
              <div className="text-slate-500 text-[10px] mt-1">
                src/agent/react-payment-agent.ts
              </div>
            </div>
          </div>
        </section>

        {/* Troubleshooting & Pre-flight Checklist */}
        <section>
          <TroubleshootingCard />
        </section>
      </div>
    </main>
  );
}
