
import React, { useState, useEffect } from 'react';
import { AppScreen, AppState } from './types';
import SplashScreen from './components/SplashScreen';
import ChatScreen from './components/ChatScreen';
import SettingsScreen from './components/SettingsScreen';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    screen: AppScreen.SPLASH,
    darkMode: false,
    voiceEnabled: true,
    language: 'English/Hindi',
  });

  useEffect(() => {
    if (appState.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appState.darkMode]);

  const navigateTo = (screen: AppScreen) => {
    setAppState(prev => ({ ...prev, screen }));
  };

  const toggleDarkMode = () => {
    setAppState(prev => ({ ...prev, darkMode: !prev.darkMode }));
  };

  const toggleVoice = () => {
    setAppState(prev => ({ ...prev, voiceEnabled: !prev.voiceEnabled }));
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-primary dark:text-white transition-colors duration-300">
      {appState.screen === AppScreen.SPLASH && (
        <SplashScreen onComplete={() => navigateTo(AppScreen.CHAT)} />
      )}
      
      {appState.screen === AppScreen.CHAT && (
        <ChatScreen 
          onOpenSettings={() => navigateTo(AppScreen.SETTINGS)} 
        />
      )}

      {appState.screen === AppScreen.SETTINGS && (
        <SettingsScreen 
          onBack={() => navigateTo(AppScreen.CHAT)}
          darkMode={appState.darkMode}
          toggleDarkMode={toggleDarkMode}
          voiceEnabled={appState.voiceEnabled}
          toggleVoice={toggleVoice}
          language={appState.language}
        />
      )}
    </div>
  );
};

export default App;
