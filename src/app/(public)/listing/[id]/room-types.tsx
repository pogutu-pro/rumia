import { BedDouble, CheckCircle2 } from 'lucide-react';

interface RoomType {
  id: string;
  room_type: string;
  price: number;
  is_available: boolean;
}

interface RoomTypesProps {
  roomTypes: RoomType[];
  fallbackPrice?: number;
}

export function RoomTypes({ roomTypes, fallbackPrice }: RoomTypesProps) {
  // If the new table doesn't have data yet, use the fallback price to render a single card
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
        {displayRooms.map((room) => (
          <div 
            key={room.id}
            className={`border rounded-2xl p-5 transition-all duration-200 ${
              room.is_available 
                ? 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-md' 
                : 'bg-slate-50 border-slate-100 opacity-70'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <BedDouble className="h-5 w-5 text-emerald-600" />
                  {room.room_type}
                </h3>
                {room.is_available ? (
                  <p className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Available Now
                  </p>
                ) : (
                  <p className="text-xs font-medium text-slate-500 mt-1">Currently Full</p>
                )}
              </div>
            </div>
            
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-2xl font-black text-slate-900">
                KES {room.price.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">/ month</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
