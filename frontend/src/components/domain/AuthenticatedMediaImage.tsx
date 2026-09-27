'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../lib/api-client';
import { Loader2, ZoomIn, X } from 'lucide-react';

export interface AuthenticatedMediaImageProps {
  storagePath?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallback?: React.ReactNode;
  authToken?: string;
  showExpandOnClick?: boolean;
  onLoaded?: () => void;
}

export function AuthenticatedMediaImage({
  storagePath,
  alt,
  className = 'w-full h-full object-cover',
  containerClassName = 'w-full h-full relative',
  fallback = null,
  authToken,
  showExpandOnClick = true,
  onLoaded
}: AuthenticatedMediaImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(storagePath));
  const [error, setError] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const activeUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!storagePath) {
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = null;
      }
      setBlobUrl(null);
      setLoading(false);
      setError(false);
      return;
    }

    // Direct data URI or blob URL
    if (
      storagePath.startsWith('data:') ||
      storagePath.startsWith('blob:') ||
      storagePath.startsWith('http://') ||
      storagePath.startsWith('https://')
    ) {
      setBlobUrl(storagePath);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(false);

    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;

    apiClient
      .getMediaBlob(storagePath, headers)
      .then((blob) => {
        if (!isMounted) return;
        // Clean up previous blob URL if any
        if (activeUrlRef.current) {
          URL.revokeObjectURL(activeUrlRef.current);
        }
        const createdUrl = URL.createObjectURL(blob);
        activeUrlRef.current = createdUrl;
        setBlobUrl(createdUrl);
        setLoading(false);
        if (onLoaded) onLoaded();
      })
      .catch((err) => {
        console.warn('[AuthenticatedMediaImage] Could not load media from storage path:', storagePath, err);
        if (!isMounted) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      isMounted = false;
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = null;
      }
    };
  }, [storagePath, authToken, onLoaded]);

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-900/90 text-slate-300 p-4 ${containerClassName}`}>
        <Loader2 className="w-6 h-6 animate-spin text-civic-blue mb-2" />
        <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400">
          Loading verified media...
        </span>
      </div>
    );
  }

  if (error || !blobUrl) {
    return <>{fallback}</>;
  }

  return (
    <>
      <div className={`${containerClassName} group`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={blobUrl}
          alt={alt}
          className={className}
          onError={() => setError(true)}
        />

        {showExpandOnClick && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            aria-label="Enlarge image"
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 shadow"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Full-resolution lightbox modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white font-mono uppercase tracking-wide">
                  Verified Resolution Proof
                </span>
                <p className="text-[11px] text-slate-400 font-mono truncate max-w-md">
                  {storagePath}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2 overflow-auto flex items-center justify-center bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={blobUrl}
                alt={alt}
                className="max-h-[75vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
