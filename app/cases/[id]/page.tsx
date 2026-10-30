"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Shield,
  Clock,
  Users,
  Brain,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { UserSession } from "@/lib/auth";

interface CaseDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  memberIds: string[];
  summary: string;
  createdAt: string;
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [user, setUser] = useState<UserSession | null>(null);
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) throw new Error("Please log in");
        const meData = await meRes.json();
        setUser(meData.user);

        const caseRes = await fetch(`/api/cases/${caseId}`);
        const caseJson = await caseRes.json();
        if (!caseRes.ok) throw new Error(caseJson.message || "Case not accessible");
        setCaseData(caseJson.case);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [caseId]);

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-zinc-500">
        Loading case file {caseId}...
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="space-y-4">
        <Link
          href="/cases"
          className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Cases
        </Link>
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error || "Case not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Link
            href="/cases"
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{caseData.title}</h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                {caseData.status}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Case ID: <span className="font-mono text-zinc-300">{caseData.id}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-zinc-400" />
            {caseData.memberIds.length} Assigned
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            {new Date(caseData.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Case Summary / Working Memory Banner */}
      <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider font-mono">
          <Brain className="w-4 h-4" />
          Case Working Memory & Summary
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">
          {caseData.summary ||
            "No extracted memory summary yet. Facts ingested by investigators will dynamically build and update this case summary."}
        </p>
      </div>

      {/* Ready for Step 4 & 5 Notice */}
      <div className="p-8 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 text-center space-y-3">
        <div className="h-10 w-10 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <MessageSquare className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-white">
          Agentic Investigation Console
        </h3>
        <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
          The case file is securely authenticated and isolated under server-side RBAC.
          Ready for <strong>Step 4 (Fact Ingestion & Event Extraction)</strong> and{" "}
          <strong>Step 5 (Memory Answering & Suspect Scoring)</strong>.
        </p>
      </div>
    </div>
  );
}

