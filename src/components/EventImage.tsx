import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

interface EventImageProps {
  src: string;
  alt: string;
  title: string;
  className?: string;
}

export const EventImage: React.FC<EventImageProps> = ({ src, alt, title, className = '' }) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-400 p-6 ${className}`}
        aria-label={alt}
      >
        <Calendar className="w-8 h-8 mb-2 text-zinc-600" strokeWidth={1.5} />
        <span className="text-sm font-medium text-center text-zinc-300 max-w-xs">{title}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
};
