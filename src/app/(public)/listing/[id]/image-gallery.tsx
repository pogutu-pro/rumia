'use client';

import { useState } from 'react';
import { LayoutGrid, ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';

interface GalleryImage {
  r2_url: string;
  category?: string;
}

interface ImageGalleryProps {
  images: (string | GalleryImage)[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const fallbackImage =
    'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=1200';
  
  // Normalize images array to always contain objects with r2_url and category
  const displayImages: GalleryImage[] = images && images.length > 0 
    ? images.map((img) => {
        if (typeof img === 'string') {
          return { r2_url: img, category: 'Room' };
        }
        return { 
          r2_url: img.r2_url || (img as any).url || fallbackImage, 
          category: img.category || 'Room' 
        };
      })
    : [{ r2_url: fallbackImage, category: 'Room' }];

  const [mobileIndex, setMobileIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handlePrev = () => {
    setMobileIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setMobileIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1));
  };

  // Get unique categories present in the images
  const categories: string[] = ['All', ...Array.from(new Set(displayImages.map(img => img.category).filter((cat): cat is string => !!cat)))];

  // Filter images based on selected category
  const filteredImages = activeCategory === 'All'
    ? displayImages
    : displayImages.filter(img => img.category === activeCategory);

  return (
    <div className="relative w-full">
      {/* Mobile view slider */}
      <div className="md:hidden relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <img
          src={displayImages[mobileIndex]?.r2_url}
          alt={`Property image ${mobileIndex + 1}`}
          className="object-cover w-full h-full"
          onClick={() => setIsModalOpen(true)}
        />
        
        {displayImages.length > 1 && (
          <>
            <button 
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 p-2 rounded-full shadow-md hover:bg-white transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-slate-700" />
            </button>
            <button 
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 p-2 rounded-full shadow-md hover:bg-white transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-slate-700" />
            </button>
            <div className="absolute bottom-4 right-4 bg-slate-900/80 px-2 py-1 rounded-md text-[11px] font-bold text-white uppercase tracking-wider">
              {mobileIndex + 1} / {displayImages.length}
            </div>
          </>
        )}
      </div>

      {/* Desktop view Airbnb-style Grid */}
      <div className="hidden md:grid grid-cols-4 gap-2 aspect-[21/9] w-full rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 relative group">
        {displayImages.length === 1 ? (
          <div className="col-span-4 h-full relative overflow-hidden" onClick={() => setIsModalOpen(true)}>
            <img src={displayImages[0].r2_url} alt="Property display" className="object-cover w-full h-full hover:scale-[1.01] transition-transform duration-500 cursor-pointer" />
          </div>
        ) : displayImages.length === 2 ? (
          <>
            <div className="col-span-2 h-full overflow-hidden" onClick={() => setIsModalOpen(true)}>
              <img src={displayImages[0].r2_url} alt="Property display 1" className="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500 cursor-pointer" />
            </div>
            <div className="col-span-2 h-full overflow-hidden" onClick={() => setIsModalOpen(true)}>
              <img src={displayImages[1].r2_url} alt="Property display 2" className="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500 cursor-pointer" />
            </div>
          </>
        ) : displayImages.length === 3 ? (
          <>
            <div className="col-span-2 row-span-2 h-full overflow-hidden" onClick={() => setIsModalOpen(true)}>
              <img src={displayImages[0].r2_url} alt="Property display 1" className="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500 cursor-pointer" />
            </div>
            <div className="col-span-2 h-full overflow-hidden" onClick={() => setIsModalOpen(true)}>
              <img src={displayImages[1].r2_url} alt="Property display 2" className="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500 cursor-pointer" />
            </div>
            <div className="col-span-2 h-full overflow-hidden" onClick={() => setIsModalOpen(true)}>
              <img src={displayImages[2].r2_url} alt="Property display 3" className="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500 cursor-pointer" />
            </div>
          </>
        ) : (
          <>
            {/* Left large photo */}
            <div className="col-span-2 row-span-2 h-full overflow-hidden relative" onClick={() => setIsModalOpen(true)}>
              <img
                src={displayImages[0].r2_url}
                alt="Property main display"
                className="object-cover w-full h-full hover:scale-[1.01] transition-transform duration-500 cursor-pointer"
              />
            </div>
            {/* Top Right photos */}
            <div className="col-span-1 h-full overflow-hidden" onClick={() => setIsModalOpen(true)}>
              <img
                src={displayImages[1]?.r2_url || fallbackImage}
                alt="Property detail 1"
                className="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500 cursor-pointer"
              />
            </div>
            <div className="col-span-1 h-full overflow-hidden" onClick={() => setIsModalOpen(true)}>
              <img
                src={displayImages[2]?.r2_url || fallbackImage}
                alt="Property detail 2"
                className="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500 cursor-pointer"
              />
            </div>
            {/* Bottom Right photos */}
            <div className="col-span-1 h-full overflow-hidden" onClick={() => setIsModalOpen(true)}>
              <img
                src={displayImages[3]?.r2_url || fallbackImage}
                alt="Property detail 3"
                className="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500 cursor-pointer"
              />
            </div>
            <div className="col-span-1 h-full overflow-hidden relative" onClick={() => setIsModalOpen(true)}>
              <img
                src={displayImages[4]?.r2_url || displayImages[0].r2_url}
                alt="Property detail 4"
                className="object-cover w-full h-full hover:scale-[1.02] transition-transform duration-500 cursor-pointer"
              />
            </div>
          </>
        )}

        {/* Show all photos button */}
        {displayImages.length > 1 && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="absolute bottom-4 right-4 bg-white/95 hover:bg-white text-slate-800 font-bold text-xs py-2 px-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-1.5 transition-all hover:scale-[1.02] cursor-pointer z-20"
          >
            <LayoutGrid className="h-4 w-4" />
            Show all photos
          </button>
        )}
      </div>

      {/* Full-Screen Premium Photo Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto flex flex-col text-slate-900 animate-in fade-in duration-200">
          {/* Header */}
          <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-6 py-4 flex items-center justify-between z-30">
            <div>
              <h3 className="text-slate-900 font-extrabold text-lg tracking-tight">Property Gallery</h3>
              <p className="text-xs text-slate-500 font-medium">{displayImages.length} total photos available</p>
            </div>
            <button
              onClick={() => {
                setIsModalOpen(false);
                setActiveCategory('All');
              }}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-full transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Content layout */}
          <div className="flex-1 flex flex-col md:flex-row h-full min-h-[calc(100vh-73px)]">
            {/* Sidebar filter tabs */}
            <div className="w-full md:w-64 bg-white border-r border-slate-100 p-6 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-x-visible shrink-0 scrollbar-none">
              {categories.map((cat) => {
                const count = cat === 'All' 
                  ? displayImages.length 
                  : displayImages.filter(img => img.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-left flex items-center justify-between gap-3 ${
                      activeCategory === cat
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                      activeCategory === cat ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Photo Grid container */}
            <div className="flex-1 p-6 md:p-10 overflow-y-auto max-h-[calc(100vh-73px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10 max-w-5xl mx-auto pb-12">
                {filteredImages.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedImage(img.r2_url)}
                    className="relative aspect-[3/2] w-full rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 group cursor-pointer shadow-md transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:border-slate-200"
                  >
                    <img src={img.r2_url} alt={`Property photo ${idx + 1}`} className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="p-3 bg-white/95 backdrop-blur-xs rounded-full border border-slate-200 shadow-md scale-90 group-hover:scale-100 transition-transform duration-300 text-slate-700">
                        <Maximize2 className="h-5 w-5" />
                      </div>
                    </div>
                    {/* Category pill */}
                    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-xs px-3 py-1 rounded-xl text-[10px] font-bold text-slate-800 uppercase tracking-wider border border-slate-200/80 shadow-xs">
                      {img.category || 'Room'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox overlay for single image */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/95 z-99 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full transition-colors cursor-pointer border border-slate-800"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="max-w-5xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-800 shadow-2xl relative">
            <img src={selectedImage} alt="Detailed view" className="object-contain max-h-[85vh] max-w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
