'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SupportedLanguage } from '../i18n/types';

export interface UseSpeechToTextOptions {
  language?: SupportedLanguage;
  onTranscript?: (transcript: string) => void;
  onError?: (errorMessage: string, errorCode?: string) => void;
}

export interface UseSpeechToTextReturn {
  isSupported: boolean;
  isListening: boolean;
  error: string | null;
  errorCode: string | null;
  startListening: () => void;
  stopListening: () => void;
  clearError: () => void;
}

export function getSpeechRecognitionLanguage(lang: SupportedLanguage): string {
  switch (lang) {
    case 'hi':
      return 'hi-IN';
    case 'or':
      return 'or-IN';
    case 'en':
    default:
      return 'en-IN';
  }
}

export function useSpeechToText({
  language = 'en',
  onTranscript,
  onError,
}: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const languageRef = useRef(language);
  languageRef.current = language;

  // Check browser support
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const isSecure = window.isSecureContext || window.location.hostname === 'localhost';
    setIsSupported(Boolean(SpeechRecognition && isSecure));
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Recognition might already be stopped
      }
      setIsListening(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  const startListening = useCallback(() => {
    clearError();

    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const msg = 'Speech recognition is not supported in this browser.';
      setError(msg);
      setErrorCode('not-supported');
      onErrorRef.current?.(msg, 'not-supported');
      return;
    }

    try {
      // Abort any existing instance
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = getSpeechRecognitionLanguage(languageRef.current);

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalChunk = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalChunk += event.results[i][0].transcript;
          }
        }

        const trimmed = finalChunk.trim();
        if (trimmed) {
          onTranscriptRef.current?.(trimmed);
        }
      };

      recognition.onerror = (event: any) => {
        const code = event.error || 'unknown';
        setErrorCode(code);

        let userMsg = 'Speech recognition error. Please try again.';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          userMsg = 'Microphone permission denied. Please allow microphone access in your browser bar.';
        } else if (code === 'no-speech') {
          userMsg = 'No speech detected. Please speak clearly into your microphone.';
        } else if (code === 'network') {
          userMsg = 'Speech network error. Please check internet connection or type manually.';
        } else if (code === 'language-not-supported') {
          userMsg = 'Selected language is not supported by your browser voice engine.';
        }

        setError(userMsg);
        onErrorRef.current?.(userMsg, code);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err: any) {
      const msg = err.message || 'Could not start voice recognition.';
      setError(msg);
      setErrorCode('start-failure');
      setIsListening(false);
      onErrorRef.current?.(msg, 'start-failure');
    }
  }, [clearError]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    error,
    errorCode,
    startListening,
    stopListening,
    clearError,
  };
}
