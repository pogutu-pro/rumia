'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Premium 3D "Rumia" Logo Label using Three.js
 * 
 * Features:
 * - Floating 3D text with subtle animations
 * - GPU-accelerated rendering
 * - Lazy-loaded Three.js dependencies
 * - Accessible fallback for low-end devices
 * - Light/dark mode compatible
 * 
 * Only use on landing page hero section for maximum impact.
 */

interface RumiaLogoLabel3DProps {
  className?: string;
  /** Enable animation (rotation, floating) */
  animated?: boolean;
  /** Fallback to CSS if Three.js fails to load */
  enableFallback?: boolean;
}

// CSS Fallback Component
function RumiaLogoLabelFallback({ className }: { className?: string }) {
  return (
    <div className={cn('relative inline-block', className)}>
      <h1
        className={cn(
          'text-6xl md:text-8xl font-black tracking-tighter',
          'bg-gradient-to-r from-primary via-emerald-600 to-primary bg-clip-text text-transparent',
          'animate-in fade-in slide-in-from-bottom-4 duration-700',
          'drop-shadow-sm'
        )}
        style={{
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Rumia
      </h1>
      <div
        className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-emerald-600/20 blur-2xl -z-10 animate-pulse"
        aria-hidden="true"
      />
    </div>
  );
}

export function RumiaLogoLabel3D({
  className,
  animated = true,
  enableFallback = true,
}: RumiaLogoLabel3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [Three, setThree] = useState<any>(null);

  useEffect(() => {
    // Lazy load Three.js only when component mounts
    let mounted = true;
    let animationFrameId: number;
    let scene: any;
    let camera: any;
    let renderer: any;
    let textMesh: any;

    async function loadThreeJS() {
      try {
        // Dynamic import to reduce initial bundle size
        const THREE = await import('three');
        const { TextGeometry } = await import('three/examples/jsm/geometries/TextGeometry.js');
        const { FontLoader } = await import('three/examples/jsm/loaders/FontLoader.js');

        if (!mounted) return;

        setThree(THREE);

        // Setup scene
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(
          75,
          containerRef.current!.offsetWidth / containerRef.current!.offsetHeight,
          0.1,
          1000
        );
        camera.position.z = 5;

        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
        });
        renderer.setSize(
          containerRef.current!.offsetWidth,
          containerRef.current!.offsetHeight
        );
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        containerRef.current!.appendChild(renderer.domElement);

        // Load font and create text
        const loader = new FontLoader();
        loader.load(
          'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
          (font: any) => {
            if (!mounted) return;

            const textGeometry = new TextGeometry('Rumia', {
              font: font,
              size: 1,
              depth: 0.2,
              curveSegments: 12,
              bevelEnabled: true,
              bevelThickness: 0.03,
              bevelSize: 0.02,
              bevelOffset: 0,
              bevelSegments: 5,
            });

            textGeometry.center();

            // Gradient-like material (emerald green)
            const material = new THREE.MeshPhongMaterial({
              color: 0x10b981, // Emerald-500
              emissive: 0x047857, // Emerald-700
              specular: 0x6ee7b7, // Emerald-300
              shininess: 100,
            });

            textMesh = new THREE.Mesh(textGeometry, material);
            scene.add(textMesh);

            // Lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            scene.add(ambientLight);

            const pointLight = new THREE.PointLight(0xffffff, 1);
            pointLight.position.set(5, 5, 5);
            scene.add(pointLight);

            const pointLight2 = new THREE.PointLight(0x10b981, 0.5);
            pointLight2.position.set(-5, -5, 5);
            scene.add(pointLight2);

            setIsLoading(false);

            // Animation loop
            function animate() {
              if (!mounted) return;
              animationFrameId = requestAnimationFrame(animate);

              if (animated && textMesh) {
                // Subtle rotation
                textMesh.rotation.y += 0.005;
                // Floating effect
                textMesh.position.y = Math.sin(Date.now() * 0.001) * 0.1;
              }

              renderer.render(scene, camera);
            }

            animate();
          },
          undefined,
          (error: any) => {
            console.error('Error loading font:', error);
            setHasError(true);
            setIsLoading(false);
          }
        );
      } catch (error) {
        console.error('Error loading Three.js:', error);
        setHasError(true);
        setIsLoading(false);
      }
    }

    loadThreeJS();

    // Cleanup
    return () => {
      mounted = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (renderer && containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
        renderer.dispose();
      }
      if (scene) {
        scene.traverse((object: any) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((material: any) => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }
    };
  }, [animated]);

  // Handle window resize
  useEffect(() => {
    function handleResize() {
      if (containerRef.current && Three) {
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        // Update camera and renderer if they exist
        // (Implementation would require storing refs to camera/renderer)
      }
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [Three]);

  // Show fallback if error or fallback enabled
  if ((hasError && enableFallback) || !containerRef) {
    return <RumiaLogoLabelFallback className={className} />;
  }

  return (
    <div className={cn('relative', className)}>
      <div
        ref={containerRef}
        className="w-full h-64 md:h-96"
        style={{ minHeight: '300px' }}
        role="img"
        aria-label="Rumia - Premium 3D Logo"
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <RumiaLogoLabelFallback />
        </div>
      )}
      {/* Screen reader text */}
      <span className="sr-only">Rumia</span>
    </div>
  );
}

// Simpler 2D variant for header/other uses
export function RumiaLogoLabel({
  variant = 'header',
  className,
}: {
  variant?: 'hero' | 'header' | 'compact';
  className?: string;
}) {
  const variants = {
    hero: 'text-6xl md:text-8xl font-black tracking-tighter',
    header: 'text-2xl md:text-3xl font-bold tracking-tight',
    compact: 'text-xl font-semibold tracking-tight',
  };

  return (
    <div className={cn('relative inline-block', className)}>
      <h1
        className={cn(
          variants[variant],
          'bg-gradient-to-r from-primary via-emerald-600 to-primary bg-clip-text text-transparent',
          'animate-in fade-in slide-in-from-bottom-4 duration-700',
          'drop-shadow-sm'
        )}
        style={{
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Rumia
      </h1>
      {variant === 'hero' && (
        <div
          className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-emerald-600/20 blur-2xl -z-10 animate-pulse"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
