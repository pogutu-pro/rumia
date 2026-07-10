import Link from 'next/link';
import { MessageCircle, ShieldCheck, ChevronRight } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

interface AgentCardProps {
  agent: {
    id: string | number;
    name: string;
    slug?: string | null;
    profile_photo_url?: string | null;
    bio?: string | null;
    service_areas?: string[] | null;
    languages?: string[] | null;
    verified?: boolean | null;
    whatsapp: string;
  };
  showBio?: boolean;
  className?: string;
}

function cleanPhone(phone: string) {
  const clean = phone.replace(/[^\d+]/g, '');
  return clean.startsWith('+') ? clean : clean.replace(/^0?/, '+254');
}

export function AgentCard({ agent, showBio = true, className }: AgentCardProps) {
  const profileUrl = agent.slug ? `/agents/${agent.slug}` : '#';

  return (
    <div
      className={cn(
        'group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden',
        className,
      )}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <Link href={profileUrl} className="shrink-0">
            <UserAvatar
              name={agent.name}
              imageUrl={agent.profile_photo_url}
              size="lg"
              className="ring-2 ring-slate-100"
            />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={profileUrl}
                className="font-bold text-slate-900 hover:text-emerald-600 transition-colors truncate"
              >
                {agent.name}
              </Link>
              {agent.verified && (
                <span className="shrink-0" title="Verified Agent">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                </span>
              )}
            </div>

            {showBio && agent.bio && (
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{agent.bio}</p>
            )}

            {agent.service_areas && agent.service_areas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {agent.service_areas.slice(0, 3).map((area) => (
                  <Badge key={area} variant="secondary" className="text-[10px] font-medium px-2 py-0.5">
                    {area}
                  </Badge>
                ))}
                {agent.service_areas.length > 3 && (
                  <span className="text-[10px] font-semibold text-slate-400 leading-6">
                    +{agent.service_areas.length - 3}
                  </span>
                )}
              </div>
            )}

            {agent.languages && agent.languages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {agent.languages.slice(0, 2).map((lang) => (
                  <span key={lang} className="text-[10px] font-medium text-slate-400">
                    {lang}
                  </span>
                ))}
                {agent.languages.length > 2 && (
                  <span className="text-[10px] font-medium text-slate-400">
                    +{agent.languages.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
          <a
            href={`https://wa.me/${cleanPhone(agent.whatsapp)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
            aria-label={`Contact ${agent.name} on WhatsApp`}
          >
            <MessageCircle className="h-4 w-4 fill-current" />
            WhatsApp
          </a>
          <Link
            href={profileUrl}
            className="flex-1 inline-flex items-center justify-center gap-1 h-10 rounded-xl border-2 border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 text-sm font-bold transition-colors"
          >
            View Profile
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
