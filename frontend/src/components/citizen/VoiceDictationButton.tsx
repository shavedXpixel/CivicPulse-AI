'use client';

import React, { useState } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { useTranslation } from '../../context/LanguageContext';

export interface VoiceDictationButtonProps {
  onTranscript: (chunk: string) => void;
  className?: string;
  disabled?: boolean;
}

export function VoiceDictationButton({
  onTranscript,
  className = '',
  disabled = false,
}: VoiceDictationButtonProps) {
  const { language, t } = useTranslation();
  const [localError, setLocalError] = useState<string | null>(null);

  const {
    isSupported,
    isListening,
    error,
    startListening,
    stopListening,
    clearError,
  } = useSpeechToText({
    language,
    onTranscript: (chunk) => {
      setLocalError(null);
      onTranscript(chunk);
    },
    onError: (msg) => {
      setLocalError(msg);
    },
  });

  const handleClick = () => {
    setLocalError(null);
    clearError();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const activeError = localError || error;

  if (!isSupported) {
    return (
      <div className={`inline-flex flex-col items-start ${className}`}>
        <button
          type="button"
          disabled
          aria-label={t('report.voiceUnsupported')}
          title={t('report.voiceUnsupported')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-sm border border-ink-border bg-canvas-subtle text-ink-tertiary cursor-not-allowed opacity-70"
        >
          <MicOff className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-mono text-[11px]">{t('report.voiceDictationStart')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={isListening ? t('report.voiceDictationStop') : t('report.voiceDictationStart')}
        aria-pressed={isListening}
        title={isListening ? t('report.voiceDictationStop') : t('report.voiceDictationStart')}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-sm border transition-all ${
          isListening
            ? 'border-civic-rose bg-rose-50 text-civic-rose animate-pulse shadow-sm font-semibold'
            : 'border-ink-border bg-canvas-card hover:bg-canvas-subtle text-ink-primary hover:border-ink-secondary'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isListening ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-civic-rose opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-civic-rose" />
            </span>
            <Mic className="w-3.5 h-3.5 text-civic-rose" />
            <span className="font-mono text-[11px] text-civic-rose">{t('report.voiceDictationStop')}</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 text-civic-terracotta" />
            <span className="font-mono text-[11px] text-ink-secondary hover:text-ink-primary">
              {t('report.voiceDictationStart')}
            </span>
          </>
        )}
      </button>

      {activeError && (
        <div
          role="alert"
          className="text-[11px] text-civic-rose flex items-center gap-1 font-mono pt-0.5"
        >
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{activeError}</span>
        </div>
      )}
    </div>
  );
}
