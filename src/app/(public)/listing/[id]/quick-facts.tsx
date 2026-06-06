import { BedDouble, Bath, Wifi, Zap, MapPin, ShieldCheck } from 'lucide-react';

interface QuickFactsProps {
  roomType?: string;
  bathroom?: string;
  internet?: boolean;
  electricity?: boolean;
  distance?: string;
  security?: string;
}

export function QuickFacts({
  roomType = 'Mixed Options',
  bathroom = 'Shared',
  internet = true,
  electricity = true,
  distance = 'Near Campus',
  security = '24/7',
}: QuickFactsProps) {
  return (
    <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 hide-scrollbar">
      {/* Room Type */}
      <div className="flex-none w-36 sm:w-auto p-4 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-xs transition-colors hover:border-emerald-200">
        <BedDouble className="h-6 w-6 text-slate-700" />
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Room Type</p>
          <p className="text-sm font-semibold text-slate-900 leading-tight">{roomType}</p>
        </div>
      </div>

      {/* Bathroom */}
      <div className="flex-none w-36 sm:w-auto p-4 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-xs transition-colors hover:border-emerald-200">
        <Bath className="h-6 w-6 text-slate-700" />
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bathroom</p>
          <p className="text-sm font-semibold text-slate-900 leading-tight">{bathroom}</p>
        </div>
      </div>

      {/* Internet */}
      <div className="flex-none w-36 sm:w-auto p-4 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-xs transition-colors hover:border-emerald-200">
        <Wifi className="h-6 w-6 text-slate-700" />
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Internet</p>
          <p className="text-sm font-semibold text-slate-900 leading-tight">{internet ? 'Available' : 'Not Included'}</p>
        </div>
      </div>

      {/* Electricity */}
      <div className="flex-none w-36 sm:w-auto p-4 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-xs transition-colors hover:border-emerald-200">
        <Zap className="h-6 w-6 text-slate-700" />
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Electricity</p>
          <p className="text-sm font-semibold text-slate-900 leading-tight">{electricity ? 'Included' : 'Tokens'}</p>
        </div>
      </div>

      {/* Distance */}
      <div className="flex-none w-36 sm:w-auto p-4 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-xs transition-colors hover:border-emerald-200">
        <MapPin className="h-6 w-6 text-slate-700" />
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Distance</p>
          <p className="text-sm font-semibold text-slate-900 leading-tight">{distance}</p>
        </div>
      </div>

      {/* Security */}
      <div className="flex-none w-36 sm:w-auto p-4 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-xs transition-colors hover:border-emerald-200">
        <ShieldCheck className="h-6 w-6 text-slate-700" />
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Security</p>
          <p className="text-sm font-semibold text-slate-900 leading-tight">{security}</p>
        </div>
      </div>
    </div>
  );
}
