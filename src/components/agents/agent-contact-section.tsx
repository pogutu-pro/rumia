import { MessageCircle, Camera, Linkedin } from 'lucide-react';

interface AgentContactSectionProps {
  whatsapp: string;
  instagram?: string | null;
  linkedin?: string | null;
  instagramPublic?: boolean | null;
  linkedinPublic?: boolean | null;
  horizontal?: boolean;
}

function cleanPhone(phone: string) {
  const clean = phone.replace(/[^\d+]/g, '');
  return clean.startsWith('+') ? clean : clean.replace(/^0?/, '+254');
}

export function AgentContactSection({
  whatsapp,
  instagram,
  linkedin,
  instagramPublic,
  linkedinPublic,
  horizontal,
}: AgentContactSectionProps) {
  const waPhone = cleanPhone(whatsapp);
  const showInstagram = instagram && instagramPublic;
  const showLinkedin = linkedin && linkedinPublic;

  if (horizontal) {
    return (
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://wa.me/${waPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm shadow-emerald-600/10"
          aria-label="Contact on WhatsApp"
        >
          <MessageCircle className="h-4 w-4 fill-current" />
          WhatsApp
        </a>

        {showInstagram && (
          <a
            href={`https://instagram.com/${instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm shadow-pink-600/10"
            aria-label="Follow on Instagram"
          >
            <Camera className="h-4 w-4" />
            Instagram
          </a>
        )}

        {showLinkedin && (
          <a
            href={`https://linkedin.com/in/${linkedin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm shadow-blue-700/10"
            aria-label="Connect on LinkedIn"
          >
            <Linkedin className="h-4 w-4 fill-current" />
            LinkedIn
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={`https://wa.me/${waPhone}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 inline-flex items-center justify-center gap-2 h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-emerald-600/10 min-w-[160px]"
        aria-label="Contact on WhatsApp"
      >
        <MessageCircle className="h-6 w-6 fill-current" />
        WhatsApp
      </a>

      {showInstagram && (
        <a
          href={`https://instagram.com/${instagram}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 h-14 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-pink-600/10 min-w-[140px]"
          aria-label="Follow on Instagram"
        >
          <Camera className="h-5 w-5" />
          Instagram
        </a>
      )}

      {showLinkedin && (
        <a
          href={`https://linkedin.com/in/${linkedin}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 h-14 rounded-2xl bg-blue-700 hover:bg-blue-600 text-white font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-blue-700/10 min-w-[140px]"
          aria-label="Connect on LinkedIn"
        >
          <Linkedin className="h-5 w-5 fill-current" />
          LinkedIn
        </a>
      )}
    </div>
  );
}
