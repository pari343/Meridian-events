import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

// Vite turns each local image into its final production URL (including hashed filenames).
// Match by basename because event records may contain either /src/... paths or plain filenames.
const imageModules = import.meta.glob('../assets/images/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const imageUrlsByFilename = Object.fromEntries(
  Object.entries(imageModules).map(([path, url]) => [
    (path.split('/').pop() ?? '').toLowerCase(),
    url,
  ])
) as Record<string, string>;

function resolveImageSource(src: string): string {
  if (!src) return '';

  // Keep external, data, and blob image URLs unchanged.
  if (/^(https?:|data:|blob:)/i.test(src)) return src;

  const rawFilename = src.split(/[/?#]/).filter(Boolean).pop() ?? '';
  let filename = rawFilename;
  try {
    filename = decodeURIComponent(rawFilename);
  } catch {
    // Keep the original filename if it contains malformed URL encoding.
  }

  return imageUrlsByFilename[filename.toLowerCase()] ?? '';
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
