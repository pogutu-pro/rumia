import { AlertTriangle, Info, Sparkles } from 'lucide-react';
import type { PublicAnnouncement, AnnouncementType } from '@/types';
import { AnnouncementMessage } from './announcement-message';

// Messages longer than this are collapsed to two lines with a "Read more"
// toggle so long notices never push the search experience too far down.
const LONG_MESSAGE_THRESHOLD = 200;

interface AnnouncementStyle {
  chip: string;
  accent: string;
  icon: typeof Info;
}

const STYLES: Record<AnnouncementType, AnnouncementStyle> = {
  warning: {
    chip: 'bg-amber-100 text-amber-700',
    accent: 'border-amber-400',
    icon: AlertTriangle,
  },
  encouragement: {
    chip: 'bg-emerald-100 text-emerald-700',
    accent: 'border-emerald-400',
    icon: Sparkles,
  },
  info: {
    chip: 'bg-sky-100 text-sky-700',
    accent: 'border-sky-400',
    icon: Info,
  },
};

interface PublicAnnouncementsProps {
  announcements: PublicAnnouncement[];
}

/**
 * Professional public-facing update/notice block. Rendered entirely on the
 * server (zero client JS unless a long message needs the expander). Returns
 * null when there is nothing to show so the page looks exactly as it does
 * today when no announcements are active.
 */
export function PublicAnnouncements({
  announcements,
}: PublicAnnouncementsProps) {
  if (!announcements || announcements.length === 0) return null;

  return (
    <section aria-label="Announcements" className="space-y-3">
      {announcements.map((announcement) => {
        const style = STYLES[announcement.type] ?? STYLES.info;
        const Icon = style.icon;
        const isLong = announcement.message.length > LONG_MESSAGE_THRESHOLD;

        return (
          <div
            key={announcement.id}
            className={`flex items-start gap-3 rounded-xl border border-slate-200 border-l-4 bg-white p-4 sm:p-5 shadow-sm ${style.accent}`}
          >
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.chip}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                {announcement.title}
              </h2>
              <div className="mt-1">
                {isLong ? (
                  <AnnouncementMessage message={announcement.message} />
                ) : (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {announcement.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
