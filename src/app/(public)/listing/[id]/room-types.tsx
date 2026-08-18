import { BedDouble, Wallet, Sparkles } from 'lucide-react';

interface RoomType {
  id: string;
  room_type: string;
  price: number;
  is_available: boolean;
  deposit?: number | null;
  furnishing_items?: string[] | null;
}

interface RoomTypesProps {
  roomTypes: RoomType[];
  fallbackPrice?: number;
  startingPrice?: number;
}

function deriveFurnishingLevel(items: string[] | null | undefined): string {
  if (!items || items.length === 0) return '';
  if (items.length <= 3) return 'Semi-furnished';
  return 'Furnished';
}

export function RoomTypes({ roomTypes, fallbackPrice, startingPrice }: RoomTypesProps) {
  const displayRooms = roomTypes && roomTypes.length > 0
    ? roomTypes
    : [
        {
          id: 'fallback-1',
          room_type: 'Standard Room',
          price: fallbackPrice || 0,
          is_available: true,
        }
      ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Room Types & Pricing</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {displayRooms.map((room) => {
          const hasDeposit = room.deposit != null && room.deposit > 0;
          const totalToMoveIn = hasDeposit ? room.price + room.deposit! : null;
          const hasFurnishing = room.furnishing_items && room.furnishing_items.length > 0;
          const furnishingLabel = deriveFurnishingLevel(room.furnishing_items);
          const isStartingFrom = startingPrice != null && room.price === startingPrice && room.is_available;

          return (
            <div
              key={room.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isStartingFrom
                  ? 'bg-white border-emerald-400 shadow-md ring-1 ring-emerald-100'
                  : 'bg-white border-slate-200 hover:border-emerald-400 hover:shadow-lg'
              }`}
            >
              {/* Card Header */}
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 text-[15px]">
                      <BedDouble className="h-5 w-5 text-emerald-600 shrink-0" />
                      <span className="truncate">{room.room_type}</span>
                    </h3>
                  </div>
                  {isStartingFrom && (
                    <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-600 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
                      Starting from
                    </span>
                  )}
                </div>
              </div>

              {/* Pricing Section */}
              <div className="px-5 pb-5 space-y-3">
                {/* Monthly Rent */}
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    KES {room.price.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">/mo</span>
                </div>

                {/* Deposit + Total to move in */}
                {hasDeposit && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5 text-slate-400" />
                        Deposit
                      </span>
                      <span className="font-bold text-slate-700 tabular-nums">KES {room.deposit!.toLocaleString()}</span>
                    </div>
                    <div className="bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-xl px-4 py-3 border border-emerald-200/60">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Total to move in</span>
                        <span className="text-lg font-black text-emerald-900 tabular-nums">
                          KES {totalToMoveIn!.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Furnishing */}
                {hasFurnishing && (
                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs font-bold text-slate-700">{furnishingLabel}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {room.furnishing_items!.map((item) => (
                        <span key={item} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-600">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
