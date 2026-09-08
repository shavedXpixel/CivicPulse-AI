'use client';

import React, { useState } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, Loader2, Building, ShieldAlert, Cpu } from 'lucide-react';
import { Button } from '../ui/Button';
import { apiClient } from '../../lib/api-client';

export interface SignalAIPreviewData {
  detected_language: string;
  normalized_summary: string;
  category: string;
  subcategory?: string | null;
  severity: string;
  urgency: string;
  affected_scope?: string | null;
  duration_days?: number | null;
  location_reference?: string | null;
  recommended_department?: string | null;
  entities: string[];
  critical_facility?: string | null;
  confidence: number;
  explanation: string;
  image_findings?: string[];
}

interface SignalAIPreviewProps {
  signalId: string;
  initialAnalysis?: SignalAIPreviewData | null;
  initialProcessingStatus: string;
  onAnalysisCompleted?: (data: SignalAIPreviewData) => void;
}

export const SignalAIPreview: React.FC<SignalAIPreviewProps> = ({
  signalId,
  initialAnalysis,
  initialProcessingStatus,
  onAnalysisCompleted
}) => {
  const [analysis, setAnalysis] = useState<SignalAIPreviewData | null>(initialAnalysis || null);
  const [processingStatus, setProcessingStatus] = useState<string>(initialProcessingStatus);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await apiClient.post<{
        data: {
          signal: any;
          analysis: SignalAIPreviewData;
          operation: any;
        };
      }>(`/api/v1/signals/${signalId}/analyze`);

      setAnalysis(res.data.analysis);
      setProcessingStatus('COMPLETED');
      if (onAnalysisCompleted) {
        onAnalysisCompleted(res.data.analysis);
      }
    } catch (err: any) {
      setProcessingStatus('FAILED');
      setError(err.message || 'AI processing failed. Please verify configuration.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getLanguageLabel = (code: string) => {
    switch (code) {
      case 'od':
        return 'Odia (ଓଡ଼ିଆ)';
      case 'hi':
        return 'Hindi (हिन्दी)';
      case 'en':
      default:
        return 'English';
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'HIGH':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'LOW':
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="rounded-2xl border border-civic-blue/30 bg-gradient-to-b from-blue-50/40 to-white p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-civic-blue text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-primary flex items-center gap-1.5">
              <span>Gemini Civic Intelligence</span>
              {processingStatus === 'COMPLETED' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-civic-emerald">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Structured</span>
                </span>
              )}
            </h4>
            <p className="text-[11px] text-ink-secondary">
              Multilingual semantic parsing & advisory municipal routing
            </p>
          </div>
        </div>

        {analysis && (
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {Math.round(analysis.confidence * 100)}% Confidence
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-civic-rose/30 bg-rose-50 text-xs text-rose-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-civic-rose shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">AI Analysis Error</div>
            <div className="text-[11px]">{error}</div>
          </div>
        </div>
      )}

      {/* Analysis Content or Trigger Button */}
      {processingStatus === 'COMPLETED' && analysis ? (
        <div className="space-y-3.5 text-xs">
          {/* Normalized Summary */}
          <div className="p-3 rounded-xl bg-white border border-ink-border space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
              Normalized Issue Summary
            </div>
            <p className="text-xs font-medium text-ink-primary leading-relaxed">
              {analysis.normalized_summary}
            </p>
          </div>

          {/* Core Structured Tags */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-white border border-ink-border">
              <span className="text-ink-tertiary block text-[10px] uppercase font-semibold">Language</span>
              <span className="font-semibold text-ink-primary">{getLanguageLabel(analysis.detected_language)}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-ink-border">
              <span className="text-ink-tertiary block text-[10px] uppercase font-semibold">Category</span>
              <span className="font-semibold text-ink-primary capitalize">{analysis.category.replace('_', ' ')}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-ink-border">
              <span className="text-ink-tertiary block text-[10px] uppercase font-semibold">Severity</span>
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border mt-0.5 ${getSeverityBadgeClass(analysis.severity)}`}>
                {analysis.severity}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-ink-border">
              <span className="text-ink-tertiary block text-[10px] uppercase font-semibold">Urgency</span>
              <span className="font-semibold text-ink-primary">{analysis.urgency}</span>
            </div>
          </div>

          {/* Advisory Department Recommendation */}
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                <Building className="w-3.5 h-3.5 text-amber-700" />
                <span>Recommended Department: {analysis.recommended_department || 'Triage Required'}</span>
              </div>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                Advisory Only
              </span>
            </div>
            <p className="text-[11px] text-amber-900/80 leading-snug">
              AI recommendation is non-authoritative. Official municipal department assignment and SLA enforcement are conducted during administrative triage (Phase 5).
            </p>
          </div>

          {/* Critical Facility Callout if detected */}
          {analysis.critical_facility && (
            <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/60 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] font-bold text-rose-900">
                  Critical Facility Exposure: {analysis.critical_facility}
                </div>
                <div className="text-[10px] text-rose-800 leading-snug">
                  High-priority public asset identified in proximity to reported civic problem.
                </div>
              </div>
            </div>
          )}

          {/* Entities & Rationale */}
          {analysis.entities && analysis.entities.length > 0 && (
            <div className="space-y-1 text-[11px]">
              <span className="text-ink-tertiary block text-[10px] uppercase font-semibold">Identified Entities</span>
              <div className="flex flex-wrap gap-1">
                {analysis.entities.map((entity, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded-md bg-canvas-subtle border border-ink-border text-ink-secondary text-[10px]">
                    {entity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Explanation */}
          <div className="p-2.5 rounded-lg bg-canvas-subtle text-[11px] text-ink-secondary leading-relaxed italic border border-ink-border/50">
            &ldquo;{analysis.explanation}&rdquo;
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-center py-2">
          <p className="text-xs text-ink-secondary leading-relaxed">
            Execute explicit AI comprehension to detect language, validate civic category, interpret severity, and recommend responsible municipal department.
          </p>

          <Button
            variant="primary"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running Gemini AI Pipeline...</span>
              </>
            ) : (
              <>
                <Cpu className="w-3.5 h-3.5" />
                <span>Analyze Signal with Gemini AI</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
