import { Heart } from "lucide-react";

export default function SavedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <Heart className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h2 className="text-lg font-semibold">No saved hostels yet</h2>
      <p className="text-sm text-muted-foreground mt-2">
        Tap the heart on any listing to save it for later.
      </p>
    </div>
  );
}
