
import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 500); // Small delay before transition
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 150);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-between bg-gradient-to-b from-[#e0f2fe] to-white dark:from-[#1a1a1a] dark:to-[#141414] overflow-hidden">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 dark:bg-white/5 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary/5 dark:bg-white/5 rounded-full blur-3xl"></div>

      <div className="h-20"></div>

      <div className="flex flex-col items-center justify-center px-4 gap-8">
        <div className="relative flex items-center justify-center w-32 h-32 bg-primary dark:bg-primary rounded-xl shadow-2xl overflow-hidden group">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          <span className="material-symbols-outlined text-white text-6xl select-none" style={{ fontVariationSettings: "'wght' 300, 'opsz' 48" }}>
            neurology
          </span>
        </div>

        <div className="flex flex-col items-center text-center">
          <h3 className="text-primary dark:text-white tracking-tight text-3xl font-bold leading-tight pb-1">
            Babul's ChatBot
          </h3>
          <p className="text-primary/70 dark:text-white/60 text-lg font-medium leading-normal">
            Your Personal AI Assistant
          </p>
        </div>
      </div>

      <div className="w-full max-w-xs pb-16 flex flex-col items-center gap-6">
        <div className="flex flex-col w-full gap-3 px-8">
          <div className="flex gap-6 justify-center">
            <p className="text-primary/50 dark:text-white/40 text-sm font-semibold tracking-widest uppercase">
              {progress >= 100 ? 'Ready' : 'Initializing'}
            </p>
          </div>
          <div className="rounded-full bg-primary/10 dark:bg-white/10 h-1.5 w-full overflow-hidden">
            <div 
              className="h-full rounded-full bg-primary dark:bg-white transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full bg-primary/20 dark:bg-white/20 ${progress > 10 ? 'animate-pulse' : ''}`}></div>
          <div className={`w-1.5 h-1.5 rounded-full bg-primary/40 dark:bg-white/40 ${progress > 40 ? 'animate-pulse' : ''}`}></div>
          <div className={`w-1.5 h-1.5 rounded-full bg-primary/20 dark:bg-white/20 ${progress > 70 ? 'animate-pulse' : ''}`}></div>
        </div>
      </div>

      <div className="absolute bottom-6 w-full text-center">
        <span className="text-xs font-medium text-primary/30 dark:text-white/20 tracking-wider uppercase">
          v2.5.1 • BABUL SECURE NODE
        </span>
      </div>
    </div>
  );
};

export default SplashScreen;
