'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { useIsMobile } from '@/hooks/use-media-query';

// ── Simple Icons SVGs (v16) ──

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <title>WhatsApp</title>
      <path
        fill="#25D366"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
      />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <title>Facebook</title>
      <path
        fill="#1877F2"
        d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <title>X</title>
      <path
        fill="currentColor"
        d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"
      />
    </svg>
  );
}

// ── Animated kebab icon ──

function KebabIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ── Helpers ──

function buildAbsoluteUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

// ── Types ──

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: {
    name: string;
    area: string;
    url: string;
    imageUrl?: string;
  };
}

// ── Animation Variants ──

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const desktopModalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 28, stiffness: 340, mass: 0.9 },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: 8,
    transition: { duration: 0.15, ease: 'easeIn' as const },
  },
};

const mobileSheetVariants = {
  hidden: { y: '100%' },
  visible: {
    y: 0,
    transition: { type: 'spring' as const, damping: 32, stiffness: 320, mass: 1 },
  },
  exit: {
    y: '100%',
    transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] as const },
  },
};

const contentStagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

const contentItem = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 22, stiffness: 200 },
  },
};

// ── Component ──

export function ShareModal({ isOpen, onClose, listing }: ShareModalProps) {
  const isMobile = useIsMobile();
  const [linkCopied, setLinkCopied] = React.useState(false);
  const absoluteUrl = React.useMemo(() => buildAbsoluteUrl(listing.url), [listing.url]);

  // Lock body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const openShareWindow = React.useCallback((href: string) => {
    const width = 600;
    const height = 600;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const popup = window.open(
      href,
      '_blank',
      `popup,noopener,noreferrer,width=${width},height=${height},left=${left},top=${top}`,
    );
    popup?.focus();
  }, []);

  const handleWhatsApp = React.useCallback(() => {
    const message = `${listing.name} - ${listing.area}\n${absoluteUrl}`;
    openShareWindow(`https://wa.me/?text=${encodeURIComponent(message)}`);
    onClose();
  }, [listing, absoluteUrl, openShareWindow, onClose]);

  const handleFacebook = React.useCallback(() => {
    openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(absoluteUrl)}`);
    onClose();
  }, [absoluteUrl, openShareWindow, onClose]);

  const handleX = React.useCallback(() => {
    const text = `Check out ${listing.name} in ${listing.area}`;
    openShareWindow(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(absoluteUrl)}`);
    onClose();
  }, [listing, absoluteUrl, openShareWindow, onClose]);

  const handleCopyLink = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setLinkCopied(true);
      toast.success('Link copied');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  }, [absoluteUrl]);

  const handleCopyShareLink = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      toast.success('Link copied');
      onClose();
    } catch {
      toast.error('Failed to copy link');
    }
  }, [absoluteUrl, onClose]);

  const handleMore = React.useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: listing.name, url: absoluteUrl });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    onClose();
  }, [listing, absoluteUrl, onClose]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  const hasNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const shareOptions = React.useMemo(() => {
    const options: Array<{
      key: string;
      label: string;
      icon: React.ReactNode;
      bgClass: string;
      onClick: () => void;
    }> = [
      {
        key: 'whatsapp',
        label: 'WhatsApp',
        icon: <WhatsAppIcon className="h-5 w-5" />,
        bgClass: 'bg-[#25D366]/10',
        onClick: handleWhatsApp,
      },
      {
        key: 'facebook',
        label: 'Facebook',
        icon: <FacebookIcon className="h-5 w-5" />,
        bgClass: 'bg-[#1877F2]/10',
        onClick: handleFacebook,
      },
      {
        key: 'x',
        label: 'X',
        icon: <XIcon className="h-5 w-5" />,
        bgClass: 'bg-gray-100',
        onClick: handleX,
      },
      {
        key: 'copy',
        label: 'Copy Link',
        icon: (
          <span className="flex h-5 w-5 items-center justify-center">
            <Copy className="h-[18px] w-[18px] text-gray-600" />
          </span>
        ),
        bgClass: 'bg-gray-100',
        onClick: handleCopyShareLink,
      },
    ];

    if (hasNativeShare) {
      options.push({
        key: 'more',
        label: 'More',
        icon: (
          <span className="flex h-5 w-5 items-center justify-center">
            <KebabIcon className="text-gray-600" />
          </span>
        ),
        bgClass: 'bg-gray-100',
        onClick: handleMore,
      });
    }

    return options;
  }, [handleWhatsApp, handleFacebook, handleX, handleCopyShareLink, handleMore, hasNativeShare]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100]"
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label="Share listing"
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/40"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {isMobile ? (
            // ── Mobile Bottom Sheet ──
            <motion.div
              className={cn(
                'absolute inset-x-0 bottom-0',
                'bg-white rounded-t-[24px]',
                'flex flex-col',
                'max-h-[90vh] overflow-y-auto',
                'shadow-[0_-4px_30px_rgba(0,0,0,0.12)]',
              )}
              variants={mobileSheetVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-1 px-6">
                <div className="w-9 h-[3px] bg-gray-300 rounded-full" />
              </div>

              <motion.div
                className="px-6 pb-6 pt-2"
                variants={contentStagger}
                initial="hidden"
                animate="visible"
              >
                <motion.div variants={contentItem}>
                  <ListingPreview listing={listing} />
                </motion.div>
                <motion.div variants={contentItem}>
                  <ShareOptions options={shareOptions} />
                </motion.div>
                <motion.div variants={contentItem}>
                  <DirectLink url={absoluteUrl} copied={linkCopied} onCopy={handleCopyLink} />
                </motion.div>
              </motion.div>
            </motion.div>
          ) : (
            // ── Desktop Modal ──
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div
                className={cn(
                  'w-full max-w-[480px]',
                  'bg-white rounded-[20px]',
                  'shadow-[0_8px_40px_rgba(0,0,0,0.15)]',
                  'max-h-[90vh] overflow-y-auto',
                  'pointer-events-auto',
                )}
                variants={desktopModalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <motion.div
                  className="p-6"
                  variants={contentStagger}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div variants={contentItem}>
                    <ListingPreview listing={listing} />
                  </motion.div>
                  <motion.div variants={contentItem}>
                    <ShareOptions options={shareOptions} />
                  </motion.div>
                  <motion.div variants={contentItem}>
                    <DirectLink url={absoluteUrl} copied={linkCopied} onCopy={handleCopyLink} />
                  </motion.div>
                </motion.div>
              </motion.div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}

// ── Sub-components ──

function ListingPreview({ listing }: { listing: ShareModalProps['listing'] }) {
  return (
    <div className="flex items-center gap-3.5 mb-6">
      <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-[#16a34a] flex items-center justify-center">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Home className="h-6 w-6 text-white" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#16a34a] mb-1">
          Share listing
        </p>
        <h2 className="text-[17px] font-semibold text-gray-900 leading-snug truncate-2">
          {listing.name}
        </h2>
        <p className="text-[13px] text-gray-500 mt-0.5">
          {listing.area}
        </p>
      </div>
    </div>
  );
}

function ShareOptions({
  options,
}: {
  options: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    bgClass: string;
    onClick: () => void;
  }>;
}) {
  return (
    <div className="flex items-start justify-between gap-1 mb-7">
      {options.map((option) => (
        <motion.button
          key={option.key}
          type="button"
          onClick={option.onClick}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.05 }}
          className={cn(
            'flex flex-col items-center gap-2',
            'min-w-[48px] min-h-[48px]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            'rounded-xl',
          )}
          aria-label={option.label}
        >
          <span
            className={cn(
              'flex items-center justify-center',
              'w-14 h-14 rounded-xl',
              'transition-colors duration-150',
              option.bgClass,
            )}
          >
            {option.icon}
          </span>
          <span className="text-[11px] font-medium text-gray-500 text-center leading-tight">
            {option.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

function DirectLink({
  url,
  copied,
  onCopy,
}: {
  url: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 mb-2.5">
        Direct link
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 bg-gray-50 rounded-[10px] px-3.5 py-2.5 border border-gray-100">
          <span className="block text-[13px] font-mono text-gray-500 truncate">
            {url}
          </span>
        </div>
        <motion.button
          type="button"
          onClick={onCopy}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'shrink-0 h-10 w-[88px] rounded-[10px] text-sm font-semibold',
            'transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            copied
              ? 'bg-[#16a34a] text-white'
              : 'bg-gray-900 text-white hover:bg-gray-800',
          )}
          aria-label={copied ? 'Copied' : 'Copy link'}
        >
          {copied ? (
            <span className="flex items-center justify-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Copied
            </span>
          ) : (
            'Copy'
          )}
        </motion.button>
      </div>
    </div>
  );
}
