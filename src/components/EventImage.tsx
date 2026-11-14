import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

// Resolve source asset paths through Vite so images keep working after production builds.
const localImages = import.meta.glob('../assets/images/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function resolveImageSource(src: string): string {
  if (!src) return '';
  if (/^(https?:|data:|blob:)/i.test(src)) return src;

  const filename = src.split(/[/?#]/).filter(Boolean).pop();
  if (!filename) return src;

  return localImages[`../assets/images/${filename}`] ?? src;
}

interface EventImageProps {
  src: string;
  alt: string;
  title: string;
  className?: string;
}

export const EventImage: React.FC<EventImageProps> = ({ src, alt, title, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveImageSource(src);

  if (failed || !resolvedSrc) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-400 p-6 ${className}`}
        aria-label={alt}
        role="img"
      >
        <Calendar className="w-8 h-8 mb-2 text-zinc-600" strokeWidth={1.5} />
        <span className="text-sm font-medium text-center text-zinc-300 max-w-xs">{title}</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
};
