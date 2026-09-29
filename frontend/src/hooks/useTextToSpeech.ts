'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SupportedLanguage } from '../i18n/types';
import { getSpeechRecognitionLanguage } from './useSpeechToText';

export interface UseTextToSpeechOptions {
  language?: SupportedLanguage;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export function useTextToSpeech({
  language = 'en',
  onEnd,
  onError,
}: UseTextToSpeechOptions = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const languageRef = useRef(language);
  languageRef.current = language;

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
    }
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
      setIsSpeaking(false);
    }
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        const speechLang = getSpeechRecognitionLanguage(languageRef.current);
        utterance.lang = speechLang;

        // Try to match specific voice if available
        const voices = window.speechSynthesis.getVoices?.() || [];
        const prefix = speechLang.split('-')[0] || speechLang;
        const matchingVoice = voices.find(
          (v) => v.lang === speechLang || (Boolean(prefix) && v.lang.startsWith(prefix))
        );
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          onEnd?.();
        };

        utterance.onerror = (e) => {
          setIsSpeaking(false);
          onError?.(e);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        setIsSpeaking(false);
        onError?.(err);
      }
    },
    [onEnd, onError]
  );

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isSupported,
    isSpeaking,
    speak,
    stop,
  };
}
