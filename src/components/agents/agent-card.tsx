import Link from 'next/link';
import { MessageCircle, ShieldCheck, ChevronRight, ExternalLink } from 'lucide-react';
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
    portfolio_url?: string | null;
    is_featured?: boolean | null;
  };
  showBio?: boolean;
  className?: string;
}

function cleanPhone(phone: string) {
  const clean = phone.replace(/[^\d+]/g, '');
  return clean.startsWith('+') ? clean : clean.replace(/^0?/, '+254');
}

function getWhatsAppUrl(phone: string, agentName: string) {
  const cleaned = cleanPhone(phone);
  const message = `Hi ${agentName}, I found your profile on Rumia while looking for student accommodation. I'm interested in finding a hostel and would appreciate your assistance. Could you please help me with available options, pricing, location, and arrange a viewing if possible? Thank you!`;
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

function getDisplayUrl(url: string) {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
  } catch {
    return url;
  }
}

export function AgentCard({ agent, showBio = true, className }: AgentCardProps) {
  const profileUrl = agent.slug ? `/agents/${agent.slug}` : '#';
  const isFeatured = !!agent.is_featured;
  const isVerified = !!agent.verified;
  const hasPortfolio = !!agent.portfolio_url;
  const whatsappUrl = getWhatsAppUrl(agent.whatsapp, agent.name);

  return (
    <div
      className={cn(
        'group relative rounded-2xl overflow-hidden transition-all duration-200 flex flex-col justify-between min-h-[290px]',
        isFeatured
          ? [
              'bg-gradient-to-br from-white via-emerald-50/10 to-white',
              'ring-1 ring-emerald-200/60',
              'shadow-[0_2px_12px_-2px_rgba(16,185,129,0.08)]',
              'hover:shadow-[0_6px_20px_-4px_rgba(16,185,129,0.12)]',
              'hover:ring-emerald-300/80',
              'md:hover:-translate-y-0.5',
            ]
          : [
              'bg-white',
              'border border-slate-150',
              'shadow-sm',
              'hover:shadow-md',
              'hover:border-slate-200',
              'md:hover:-translate-y-0.5',
            ],
        'active:scale-[0.99] md:active:scale-100',
        className,
      )}
    >
      <Link
        href={profileUrl}
        className="block p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-t-2xl flex-1"
        aria-label={`View ${agent.name}'s profile`}
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0 relative">
            <UserAvatar
              name={agent.name}
              imageUrl={agent.profile_photo_url}
              size="lg"
              className={cn(
                'ring-2 transition-shadow duration-200',
                isFeatured
                  ? 'ring-emerald-200 group-hover:ring-emerald-300 shadow-md shadow-emerald-100/50'
                  : 'ring-slate-100 group-hover:ring-slate-200',
              )}
            />
            {(isVerified || isFeatured) && (
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white"
                title={isFeatured ? "Official Rumia Agent" : "Verified Agent"}
                aria-label={isFeatured ? "Official Rumia Agent" : "Verified Agent"}
              >
                <ShieldCheck className="h-3 w-3 text-white" aria-hidden="true" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-[15px] text-slate-900 truncate group-hover:text-emerald-600 transition-colors duration-200 leading-snug">
                {agent.name}
              </span>
            </div>

            {/* Badges immediately below name */}
            {(isFeatured || isVerified) && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {isFeatured && (
                  <>
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[9px] font-bold uppercase tracking-wider">
                      <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" />
                      Official
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/70 text-amber-700 text-[9px] font-bold uppercase tracking-wider">
                      Founder
                    </span>
                  </>
                )}
                {isVerified && !isFeatured && (
                  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider">
                    Verified
                  </span>
                )}
              </div>
            )}

            {showBio && agent.bio && (
              <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{agent.bio}</p>
            )}

            {agent.service_areas && agent.service_areas.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {agent.service_areas.slice(0, 3).map((area) => (
                  <Badge
                    key={area}
                    variant="secondary"
                    className={cn(
                      'text-[9px] font-semibold px-2 py-0.5 rounded-md border border-slate-100',
                      isFeatured
                        ? 'bg-emerald-50/50 text-emerald-700 border-emerald-100/60'
                        : 'bg-slate-50 text-slate-600',
                    )}
                  >
                    {area}
                  </Badge>
                ))}
                {agent.service_areas.length > 3 && (
                  <span className="text-[9px] font-bold text-slate-400 leading-5 pl-0.5">
                    +{agent.service_areas.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Portfolio URL - rendered outside of Link for direct action */}
      {hasPortfolio && (
        <div className="px-5 pb-1">
          <a
            href={agent.portfolio_url!.startsWith('http') ? agent.portfolio_url! : `https://${agent.portfolio_url!}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 p-2 px-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 text-[11px] font-medium text-emerald-600 transition-colors"
            title="Visit portfolio website"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Portfolio</span>
            <span className="truncate flex-1 text-right text-slate-500 font-semibold group-hover/port:text-emerald-700">
              {getDisplayUrl(agent.portfolio_url!)}
            </span>
          </a>
        </div>
      )}

      {/* Action buttons */}
      <div className={cn(
        'flex items-center gap-2 px-5 py-4',
        isFeatured ? 'border-t border-emerald-100/40' : 'border-t border-slate-100',
      )}>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl text-xs font-bold transition-all duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
            isFeatured
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:shadow active:scale-[0.97]'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:shadow active:scale-[0.97]',
          )}
          aria-label={`Contact ${agent.name} on WhatsApp`}
          onClick={(e) => e.stopPropagation()}
        >
          <MessageCircle className="h-4 w-4 fill-current" />
          WhatsApp
        </a>
        <Link
          href={profileUrl}
          className={cn(
            'flex-1 inline-flex items-center justify-center gap-1 h-10 rounded-xl text-xs font-bold transition-all duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
            isFeatured
              ? 'border border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/20 text-emerald-700 active:scale-[0.97]'
              : 'border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 active:scale-[0.97]',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          View Profile
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
