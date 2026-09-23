import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ShoppingBag, ArrowRight } from 'lucide-react';

// Shared linear gradients definition for premium styling
const GlobalGradients = () => (
  <svg className="absolute w-0 h-0" width="0" height="0">
    <defs>
      <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFB52E" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#F5A524" stopOpacity="0.02" />
      </linearGradient>
      <linearGradient id="goldStroke" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFB52E" />
        <stop offset="50%" stopColor="#F5A524" />
        <stop offset="100%" stopColor="#E0921B" />
      </linearGradient>
    </defs>
  </svg>
);

// Custom high-quality inline SVG placeholders for each category
const SVGPlaceholders = {
  't-shirts': (
    <svg className="w-full h-full text-menx-primary/30" viewBox="0 0 100 100" fill="url(#goldGradient)" stroke="url(#goldStroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 30 L35 20 L42 28 L42 85 L58 85 L58 28 L65 20 L80 30 L73 45 L65 42 L65 85 C65 89, 35 89, 35 85 L35 42 L27 45 Z" />
      <path d="M42 20 C42 24, 58 24, 58 20" />
    </svg>
  ),
  'shirts': (
    <svg className="w-full h-full text-menx-primary/30" viewBox="0 0 100 100" fill="url(#goldGradient)" stroke="url(#goldStroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M25 25 L40 18 L50 26 L60 18 L75 25 L75 85 L25 85 Z" />
      <path d="M50 26 L50 85" strokeDasharray="3 3" />
      <circle cx="50" cy="40" r="1.5" fill="#F5A524" stroke="none" />
      <circle cx="50" cy="55" r="1.5" fill="#F5A524" stroke="none" />
      <circle cx="50" cy="70" r="1.5" fill="#F5A524" stroke="none" />
      <path d="M35 18 L40 28" />
      <path d="M65 18 L60 28" />
    </svg>
  ),
  'jeans': (
    <svg className="w-full h-full text-menx-primary/30" viewBox="0 0 100 100" fill="url(#goldGradient)" stroke="url(#goldStroke)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M30 15 L70 15 L75 50 L70 90 L52 90 L50 45 L48 90 L30 90 L25 50 Z" />
      <path d="M30 25 L70 25" />
      <path d="M40 15 L40 25" />
      <path d="M60 15 L60 25" />
      <path d="M35 35 C35 35, 42 38, 48 35" />
      <path d="M65 35 C65 35, 58 38, 52 35" />
    </svg>
  ),
  'trousers': (
    <svg className="w-full h-full text-menx-primary/30" viewBox="0 0 100 100" fill="url(#goldGradient)" stroke="url(#goldStroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M32 15 L68 15 L72 45 L68 88 L51 88 L50 40 L49 88 L32 88 L28 45 Z" />
      <path d="M32 20 L68 20" />
      <path d="M50 15 L50 40" strokeDasharray="4 4" />
    </svg>
  ),
  'shorts': (
    <svg className="w-full h-full text-menx-primary/30" viewBox="0 0 100 100" fill="url(#goldGradient)" stroke="url(#goldStroke)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M28 20 L72 20 L76 55 L52 55 L50 35 L48 55 L24 55 Z" />
      <path d="M28 28 L72 28" />
    </svg>
  ),
  'jackets': (
    <svg className="w-full h-full text-menx-primary/30" viewBox="0 0 100 100" fill="url(#goldGradient)" stroke="url(#goldStroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 28 L38 20 L50 28 L62 20 L80 28 L75 85 L25 85 Z" />
      <path d="M35 28 L50 45 L65 28" />
      <path d="M50 45 L50 85" strokeWidth="3" />
      <path d="M25 50 L35 50" />
      <path d="M75 50 L65 50" />
    </svg>
  ),
  'ethnic-wear': (
    <svg className="w-full h-full text-menx-primary/30" viewBox="0 0 100 100" fill="url(#goldGradient)" stroke="url(#goldStroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M30 15 L42 15 L50 22 L58 15 L70 15 L66 88 L34 88 Z" />
      <path d="M50 22 L50 88" />
      <path d="M42 30 L58 30" />
      <path d="M44 42 L56 42" />
      <path d="M46 54 L54 54" />
    </svg>
  ),
  'activewear': (
    <svg className="w-full h-full text-menx-primary/30" viewBox="0 0 100 100" fill="url(#goldGradient)" stroke="url(#goldStroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 30 L36 20 L50 28 L64 20 L78 30 L72 82 L28 82 Z" />
      <path d="M15 42 L32 38 L34 82" strokeWidth="1.5" />
      <path d="M85 42 L68 38 L66 82" strokeWidth="1.5" />
      <path d="M38 52 H62" strokeWidth="3" />
    </svg>
  ),
  'footwear': (
    <svg className="w-full h-full text-menx-primary/30" viewBox="0 0 100 100" fill="url(#goldGradient)" stroke="url(#goldStroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 65 C15 50, 30 40, 50 40 C65 40, 85 48, 85 65 C85 75, 75 75, 50 75 C25 75, 15 75, 15 65 Z" />
      <path d="M50 40 L60 55 M53 38 L65 52" strokeWidth="1.5" />
      <path d="M35 75 C35 75, 45 78, 65 75" strokeWidth="3" />
    </svg>
  ),
  'accessories': (
    <svg className="w-full h-full text-menx-primary/30" viewBox="0 0 100 100" fill="url(#goldGradient)" stroke="url(#goldStroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="50" cy="50" r="22" />
      <path d="M50 12 V28 M50 72 V88" strokeWidth="4" />
      <path d="M50 50 L58 42 M50 50 L50 62" />
      <circle cx="50" cy="50" r="2" fill="#F5A524" stroke="none" />
    </svg>
  )
};

// Curated promotional copywriting for the slider
const PromotionalDetails = {
  't-shirts': {
    title: 'Casual Essentials',
    description: 'Upgrade your daily rotation with relaxed fits, heavy cotton blends, and modern printed styles.',
    cta: 'EXPLORE TEES'
  },
  'shirts': {
    title: 'Sartorial Distinction',
    description: 'Crisp oxford cottons, casual linen fits, and textured checked shirts designed for versatility.',
    cta: 'SHOP SHIRTS'
  },
  'jeans': {
    title: 'Indestructible Denim',
    description: 'Discover premium denim tailored in slim, straight, and relaxed fits for all-day utility.',
    cta: 'EXPLORE DENIM'
  },
  'trousers': {
    title: 'Refined Comfort',
    description: 'Perfect office-to-evening transitions with smart chinos, tailored cargos, and casual trousers.',
    cta: 'SHOP TROUSERS'
  },
  'shorts': {
    title: 'Weekend Ease',
    description: 'Lightweight utility shorts engineered for ventilation and absolute mobility.',
    cta: 'SHOP SHORTS'
  },
  'jackets': {
    title: 'Layering Re-imagined',
    description: 'Elevate your outerwear with bomber jackets, raw denim layers, and lightweight windbreakers.',
    cta: 'SHOP JACKETS'
  },
  'ethnic-wear': {
    title: 'Traditional Sophistication',
    description: 'Premium Kurtas and tailored Nehru jackets curated for festive celebrations and heritage styling.',
    cta: 'EXPLORE ETHNIC'
  },
  'activewear': {
    title: 'High-Performance Athletics',
    description: 'Aerofit sports jerseys, breathable tees, and training track pants engineered for motion.',
    cta: 'SHOP ACTIVEWEAR'
  },
  'footwear': {
    title: 'Step with Purpose',
    description: 'Leather Chelsea boots, smart formal brogues, and daily-wear sneakers built for endurance.',
    cta: 'EXPLORE FOOTWEAR'
  },
  'accessories': {
    title: 'Sartorial Accents',
    description: 'Premium leather belts, compact wallets, modern watches, and polarized eyewear.',
    cta: 'SHOP ACCESSORIES'
  }
};

function CategorySlider({ categories, onSelectCategory }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);

  // Filter to only display active categories that exist in our promotional dictionary
  const activePromoCategories = (categories || []).filter(
    (cat) => cat && cat.slug && PromotionalDetails[cat.slug]
  );

  // Autoplay handler
  useEffect(() => {
    if (activePromoCategories.length <= 1 || isHovered) return;

    const interval = setInterval(() => {
      setActiveIndex((prevIndex) => (prevIndex + 1) % activePromoCategories.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [activePromoCategories, isHovered]);

  if (activePromoCategories.length === 0) return null;

  const handlePrev = () => {
    setActiveIndex((prevIndex) => 
      prevIndex === 0 ? activePromoCategories.length - 1 : prevIndex - 1
    );
  };

  const handleNext = () => {
    setActiveIndex((prevIndex) => (prevIndex + 1) % activePromoCategories.length);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      handleNext();
    }
  };

  // Touch Swipe Handlers for mobile device gestures
  const handleTouchStart = (e) => {
    touchEndRef.current = null;
    touchStartRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;
    const distance = touchStartRef.current - touchEndRef.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrev();
    }
  };

  return (
    <section 
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 sm:mt-6"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Category promotions"
    >
      <GlobalGradients />
      <div 
        className="relative w-full h-[190px] sm:h-[250px] md:h-[290px] lg:h-[330px] bg-gradient-to-r from-[#121821] via-[#151D28] to-[#121821] border border-menx-border rounded-2xl overflow-hidden shadow-2xl flex items-center select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Ambient radial background glow behind the active visual on the right */}
        <div className="absolute right-0 top-0 bottom-0 w-[50%] bg-[radial-gradient(circle_at_70%_50%,rgba(245,165,36,0.12),transparent_60%)] pointer-events-none z-0" />

        {/* Slides list */}
        {activePromoCategories.map((cat, idx) => {
          const promo = PromotionalDetails[cat.slug];
          const isActive = idx === activeIndex;

          return (
            <div
              key={cat.id}
              onClick={() => onSelectCategory(cat.slug)}
              className={`absolute inset-0 w-full h-full flex items-center justify-between p-5 sm:p-8 md:p-12 gap-4 transition-all duration-700 ease-in-out cursor-pointer ${
                isActive 
                  ? 'opacity-100 z-10 translate-x-0 scale-100' 
                  : 'opacity-0 z-0 pointer-events-none translate-x-8 scale-95'
              }`}
            >
              {/* Left Content Column */}
              <div className="flex-grow space-y-2 sm:space-y-3.5 text-left z-10 max-w-[60%] sm:max-w-lg">
                <span className="text-[9px] sm:text-xs text-menx-primary font-bold font-mono tracking-wider uppercase bg-menx-primary/10 px-3 py-1 rounded-full border border-menx-primary/25 inline-block">
                  {cat.name} Collection
                </span>
                <h2 className="text-lg sm:text-2xl md:text-4xl lg:text-5xl font-black text-menx-text leading-tight tracking-tight mt-1 sm:mt-2">
                  {promo.title}
                </h2>
                <p className="text-xs sm:text-sm md:text-base text-menx-text-secondary font-normal leading-relaxed max-w-[220px] sm:max-w-xs md:max-w-md line-clamp-2 sm:line-clamp-none mt-1 sm:mt-2">
                  {promo.description}
                </p>
                <div className="pt-1.5 sm:pt-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCategory(cat.slug);
                    }}
                    className="inline-flex items-center space-x-2 py-2 px-4 sm:py-2.5 sm:px-6 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-extrabold rounded-xl text-xs sm:text-sm tracking-wider transition-all duration-200 shadow-lg shadow-menx-primary/20 active:scale-95 cursor-pointer"
                  >
                    <span>{promo.cta}</span>
                    <ArrowRight className="w-4 h-4 text-[#0B0F14]" />
                  </button>
                </div>
              </div>

              {/* Right Graphical Column */}
              <div className="relative w-[32%] sm:w-[38%] h-full flex items-center justify-center shrink-0 z-10">
                {/* Glow ring behind product */}
                <div className="absolute inset-0 bg-gradient-to-r from-menx-primary/5 to-transparent blur-2xl rounded-full scale-75 sm:scale-100" />
                
                {cat.image_url ? (
                  // Admin Managed Banner URL
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    width="400"
                    height="220"
                    loading={idx === 0 ? "eager" : "lazy"}
                    fetchPriority={idx === 0 ? "high" : "auto"}
                    decoding="async"
                    className="w-full h-full max-h-[110px] sm:max-h-[220px] object-contain drop-shadow-[0_8px_16px_rgba(245,158,11,0.2)] hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.target.onerror = null;
                      // Fallback to local vector if URL fails
                      e.target.style.display = 'none';
                      const svgSibling = e.target.nextElementSibling;
                      if (svgSibling) svgSibling.style.display = 'block';
                    }}
                  />
                ) : null}
                
                {/* Local Vector Graphics Placeholder */}
                <div 
                  className="w-full h-full max-h-[110px] sm:max-h-[220px] flex items-center justify-center filter drop-shadow-[0_8px_16px_rgba(245,158,11,0.15)]"
                  style={{ display: cat.image_url ? 'none' : 'flex' }}
                >
                  {SVGPlaceholders[cat.slug] || <ShoppingBag className="w-14 h-14 sm:w-20 sm:h-20 text-menx-text-muted" />}
                </div>
              </div>
            </div>
          );
        })}

        {/* Previous Button (Desktop) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full border border-menx-border bg-menx-surface-elevated/90 hover:bg-menx-surface text-menx-text hover:text-menx-primary rounded-full shadow-lg transition-all hidden md:flex items-center justify-center z-20 cursor-pointer backdrop-blur-sm"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Next Button (Desktop) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full border border-menx-border bg-menx-surface-elevated/90 hover:bg-menx-surface text-menx-text hover:text-menx-primary rounded-full shadow-lg transition-all hidden md:flex items-center justify-center z-20 cursor-pointer backdrop-blur-sm"
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Pagination Indicator Dots */}
      {activePromoCategories.length > 1 && (
        <div className="flex items-center justify-center space-x-2 mt-3.5">
          {activePromoCategories.map((_, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  isActive ? 'w-5 bg-menx-primary' : 'w-1.5 bg-menx-border hover:bg-menx-text-muted'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
                aria-current={isActive ? 'true' : 'false'}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

export default React.memo(CategorySlider);

