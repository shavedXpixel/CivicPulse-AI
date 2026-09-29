'use client';

import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useTextToSpeech } from '../../hooks/useTextToSpeech';
import { useTranslation } from '../../context/LanguageContext';

export interface VoiceReadAloudButtonProps {
  textToRead: string;
  className?: string;
  label?: string;
}

export function VoiceReadAloudButton({
  textToRead,
  className = '',
  label,
}: VoiceReadAloudButtonProps) {
  const { language, t } = useTranslation();
  const { isSupported, isSpeaking, speak, stop } = useTextToSpeech({ language });

  if (!isSupported) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSpeaking) {
      stop();
    } else {
      speak(textToRead);
    }
  };

  const defaultLabel = isSpeaking ? t('common.stopReading') : (label || t('common.readAloud'));

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={defaultLabel}
      title={defaultLabel}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors border ${
        isSpeaking
          ? 'bg-civic-blueLight text-civic-blue border-civic-blue animate-pulse'
          : 'bg-canvas-subtle text-ink-secondary hover:text-ink-primary border-ink-border hover:border-ink-secondary'
      } ${className}`}
    >
      {isSpeaking ? (
        <>
          <VolumeX className="w-3.5 h-3.5 text-civic-blue" />
          <span className="text-[11px] font-medium text-civic-blue">{t('common.stopReading')}</span>
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5 text-ink-tertiary" />
          <span className="text-[11px] font-medium">{defaultLabel}</span>
        </>
      )}
    </button>
  );
}
