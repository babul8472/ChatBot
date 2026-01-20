
import React from 'react';
import { chatService } from '../services/gemini';

interface SettingsScreenProps {
  onBack: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  voiceEnabled: boolean;
  toggleVoice: () => void;
  language: string;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ 
  onBack, 
  darkMode, 
  toggleDarkMode, 
  voiceEnabled, 
  toggleVoice, 
  language 
}) => {

  const handleClearHistory = () => {
    if (confirm("Clear Babul's ChatBot history?")) {
      chatService.reset();
      onBack();
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-md bg-white dark:bg-background-dark shadow-xl flex flex-col sm:rounded-[3rem] sm:my-4 sm:border-[8px] sm:border-primary">
      <div className="px-4 pt-12 pb-4">
        <button onClick={onBack} className="text-primary dark:text-white flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined">arrow_back_ios</span>
          <span className="text-sm font-semibold">Back</span>
        </button>
        <h1 className="text-3xl font-bold text-primary dark:text-white">Settings</h1>
      </div>

      <div className="px-4 pb-20 space-y-6 flex-1 overflow-y-auto no-scrollbar">
        <section className="bg-primary/5 dark:bg-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium dark:text-white">Dark Mode</span>
            <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} className="rounded text-primary" />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium dark:text-white">Voice Mode</span>
            <input type="checkbox" checked={voiceEnabled} onChange={toggleVoice} className="rounded text-primary" />
          </div>
        </section>

        <button onClick={handleClearHistory} className="w-full text-rose-500 font-bold p-4 bg-rose-50 dark:bg-rose-500/10 rounded-2xl">
          Clear Chat History
        </button>

        <div className="flex flex-col items-center justify-center pt-8 gap-1 opacity-50">
          <span className="material-symbols-outlined text-3xl">auto_awesome</span>
          <p className="text-sm font-semibold">Babul's ChatBot</p>
          <p className="text-[10px]">Grounding & Vision Enabled • v2.5.1</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
