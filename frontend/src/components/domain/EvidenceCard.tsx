import React from 'react';
import { Camera, MapPin, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';

export interface EvidenceCardProps {
  type: 'CITIZEN_REPORT' | 'RESOLUTION_PROOF' | 'FIELD_INSPECTION';
  title: string;
  timestamp: string;
  source: string;
  location?: string;
  coordinates?: string;
  imageUrl?: string;
  notes?: string;
  confidence?: number;
  isVerified?: boolean;
}

export function EvidenceCard({
  type,
  title,
  timestamp,
  source,
  location,
  coordinates,
  imageUrl,
  notes,
  confidence,
  isVerified = false,
}: EvidenceCardProps) {
  return (
    <div className="rounded-xl border border-ink-border bg-white shadow-card overflow-hidden space-y-4 p-5">
      <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
        <div className="space-y-0.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary">
            {type.replace(/_/g, ' ')}
          </span>
          <h4 className="text-sm font-semibold text-ink-primary">{title}</h4>
        </div>

        {confidence !== undefined && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-civic-emeraldLight text-emerald-800 text-xs font-mono font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-civic-emerald" />
            <span>{confidence}% CONFIDENCE</span>
          </div>
        )}
      </div>

      {/* Media Mockup or Image */}
      <div className="aspect-[16/9] rounded-lg bg-canvas-subtle border border-ink-border flex flex-col items-center justify-center p-4 text-center relative overflow-hidden">
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover rounded-lg"
          />
        ) : (
          <div className="space-y-1 text-ink-tertiary">
            <Camera className="w-8 h-8 mx-auto" />
            <div className="text-xs font-medium text-ink-secondary">Field Photographic Record</div>
            {coordinates && <div className="text-[10px] font-mono">{coordinates}</div>}
          </div>
        )}
        {isVerified && (
          <div className="absolute top-2 right-2 bg-white/95 px-2 py-0.5 rounded shadow-subtle border border-ink-border text-[10px] font-mono text-civic-emerald font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>EXIF Validated</span>
          </div>
        )}
      </div>

      {notes && (
        <p className="text-xs text-ink-secondary leading-relaxed bg-canvas-subtle/50 p-3 rounded-lg border border-ink-border/50">
          &ldquo;{notes}&rdquo;
        </p>
      )}

      <div className="pt-2 border-t border-ink-border/60 flex flex-wrap items-center justify-between text-[11px] text-ink-secondary gap-2 font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-ink-tertiary" />
            {timestamp}
          </span>
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-ink-tertiary" />
              {location}
            </span>
          )}
        </div>
        <span className="text-ink-tertiary">Source: {source}</span>
      </div>
    </div>
  );
}
