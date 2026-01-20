
import React, { useState, useRef, useEffect } from 'react';
import { Message, GroundingChunk } from '../types';
import { chatService } from '../services/gemini';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface ChatScreenProps {
  onOpenSettings: () => void;
}

// Audio Decoding/Encoding Helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ onOpenSettings }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "Babul's ChatBot ready. I'm now faster than ever with streaming! How can I help?" }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{data: string, type: string, name: string} | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveSessionRef = useRef<any>(null);
  const audioContextsRef = useRef<{input?: AudioContext, output?: AudioContext}>({});
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachedFile({ data: base64, type: file.type, name: file.name });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    const msgText = inputValue.trim();
    if (!msgText && !attachedFile) return;

    const userMessage: Message = { 
      role: 'user', 
      text: msgText, 
      imageUrl: attachedFile?.type.startsWith('image/') ? `data:${attachedFile.type};base64,${attachedFile.data}` : undefined,
      fileName: attachedFile ? attachedFile.name : undefined,
      fileType: attachedFile ? attachedFile.type : undefined
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    const currentFile = attachedFile;
    setAttachedFile(null);
    setIsTyping(true);

    // Placeholder for model response
    const modelMsgIndex = messages.length + 1;
    setMessages(prev => [...prev, { role: 'model', text: "" }]);

    try {
      const stream = chatService.sendMessageStream(msgText, currentFile?.data, currentFile?.type);
      
      for await (const chunk of stream) {
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[modelMsgIndex] = { 
            ...newMsgs[modelMsgIndex], 
            text: chunk.text, 
            imageUrl: chunk.imageUrl,
            groundingLinks: chunk.groundingLinks
          };
          return newMsgs;
        });
        setIsTyping(false); // Hide spinner as soon as first chunk arrives
      }
    } catch (error) {
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[modelMsgIndex] = { role: 'model', text: "Error: Connection lost." };
        return newMsgs;
      });
    } finally {
      setIsTyping(false);
    }
  };

  const stopLiveMode = () => {
    if (liveSessionRef.current) { liveSessionRef.current.close(); liveSessionRef.current = null; }
    for (const source of sourcesRef.current) try { source.stop(); } catch (e) {}
    sourcesRef.current.clear();
    if (audioContextsRef.current.input) audioContextsRef.current.input.close();
    if (audioContextsRef.current.output) audioContextsRef.current.output.close();
    audioContextsRef.current = {};
    setIsLiveActive(false);
  };

  const startLiveMode = async () => {
    try {
      // Always initialize GoogleGenAI with the process.env.API_KEY directly as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: 'Babul\'s ChatBot. snappy voice mode.'
        },
        callbacks: {
          onopen: () => {
            setIsLiveActive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const outCtx = audioContextsRef.current.output!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const buf = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
              const src = outCtx.createBufferSource();
              src.buffer = buf; src.connect(outCtx.destination); src.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buf.duration;
              sourcesRef.current.add(src);
              src.onended = () => sourcesRef.current.delete(src);
            }
            if (msg.serverContent?.interrupted) {
              for (const s of sourcesRef.current) try { s.stop(); } catch(e) {}
              sourcesRef.current.clear(); nextStartTimeRef.current = 0;
            }
            if (msg.serverContent?.inputTranscription) currentInputTranscriptionRef.current += msg.serverContent.inputTranscription.text;
            if (msg.serverContent?.outputTranscription) currentOutputTranscriptionRef.current += msg.serverContent.outputTranscription.text;
            if (msg.serverContent?.turnComplete) {
              const u = currentInputTranscriptionRef.current, m = currentOutputTranscriptionRef.current;
              if (u || m) setMessages(prev => [...prev, ...(u ? [{ role: 'user' as const, text: u }] : []), ...(m ? [{ role: 'model' as const, text: m }] : [])]);
              currentInputTranscriptionRef.current = ''; currentOutputTranscriptionRef.current = '';
            }
          },
          onerror: (e) => { console.error(e); stopLiveMode(); },
          onclose: () => stopLiveMode()
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err) { console.error(err); stopLiveMode(); }
  };

  const getFileIcon = (type?: string) => {
    if (type?.startsWith('image/')) return 'image';
    if (type === 'application/pdf') return 'picture_as_pdf';
    return 'description';
  };

  return (
    <div className="flex h-screen w-full flex-col bg-white dark:bg-black overflow-hidden sm:max-w-md sm:mx-auto sm:border-[8px] sm:border-primary sm:rounded-[3rem] sm:my-4 sm:shadow-2xl relative">
      <header className="flex items-center bg-transparent backdrop-blur-md sticky top-0 z-10 p-4 justify-between shrink-0">
        <h2 className="text-primary dark:text-white text-xl font-bold tracking-tight">Babul's ChatBot</h2>
        <button onClick={onOpenSettings} className="flex items-center justify-center rounded-full w-10 h-10 bg-white/50 dark:bg-white/10 text-primary dark:text-white">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>

      <div className="chat-gradient flex-1 overflow-y-auto px-4 pt-4 pb-48 flex flex-col gap-4 no-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex items-end gap-3 ${msg.role === 'user' ? 'self-end max-w-[85%]' : 'max-w-[85%]'}`}>
            {msg.role === 'model' && (
              <div className="bg-primary/5 dark:bg-white/10 rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary dark:text-white text-lg">smart_toy</span>
              </div>
            )}
            <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-2xl px-4 py-3 shadow-sm text-[15px] leading-relaxed transition-all duration-200 ${msg.role === 'user' ? 'bg-ios-blue text-white rounded-br-none' : 'bg-white dark:bg-[#2C2C2E] text-primary dark:text-white rounded-bl-none'}`}>
                {msg.imageUrl && <img src={msg.imageUrl} alt="preview" className="max-w-full rounded-lg mb-2 border border-white/20" />}
                {msg.fileName && !msg.imageUrl && (
                  <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-black/10 dark:bg-white/10 border border-white/10">
                    <span className="material-symbols-outlined text-[18px]">{getFileIcon(msg.fileType)}</span>
                    <span className="text-xs font-medium truncate max-w-[150px]">{msg.fileName}</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.text || (idx === messages.length -1 && msg.role === 'model' ? "..." : "")}</p>
                {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-primary/10 dark:border-white/10">
                    <p className="text-[10px] uppercase font-bold opacity-50 mb-2">Sources:</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.groundingLinks.map((link, lidx) => (
                        <a key={lidx} href={link.web?.uri || link.maps?.uri} target="_blank" rel="noopener" className="text-[11px] bg-primary/5 dark:bg-white/10 px-2 py-1 rounded-full hover:underline truncate max-w-[150px]">
                          {link.web?.title || link.maps?.title || "Visit Link"}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isTyping && <div className="p-4 text-xs opacity-50 animate-pulse">Babul's AI is responding...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="absolute bottom-0 w-full pb-8 pt-4 px-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-20">
        {isLiveActive && (
          <div className="flex justify-center mb-2 animate-pulse"><p className="text-[10px] font-bold text-rose-500 uppercase">Live Voice Mode Active</p></div>
        )}
        
        {attachedFile && (
          <div className="relative inline-block mb-3 p-1 bg-white dark:bg-[#1C1C1E] rounded-lg border border-primary/10">
            {attachedFile.type.startsWith('image/') ? (
              <img src={`data:${attachedFile.type};base64,${attachedFile.data}`} className="h-16 w-16 object-cover rounded-md" alt="preview" />
            ) : (
              <div className="h-16 px-3 flex items-center gap-2 bg-primary/5 dark:bg-white/10 rounded-md border border-primary/10">
                <span className="material-symbols-outlined text-primary/60 dark:text-white/60">description</span>
                <span className="text-xs font-medium truncate max-w-[100px]">{attachedFile.name}</span>
              </div>
            )}
            <button onClick={() => setAttachedFile(null)} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full size-5 flex items-center justify-center text-[12px] shadow-md">×</button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-background-light dark:bg-[#1C1C1E] rounded-2xl px-3 py-1.5 border border-primary/5">
            <input 
              className="bg-transparent border-none focus:ring-0 text-[15px] flex-1 text-primary dark:text-white py-2" 
              placeholder={isLiveActive ? "Listening..." : "Instant reply mode..."}
              type="text" value={inputValue} disabled={isLiveActive}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <div className="flex gap-1">
              <button onClick={() => fileInputRef.current?.click()} className="text-primary/40 dark:text-white/40 p-1 hover:text-primary transition-colors">
                <span className="material-symbols-outlined">attach_file</span>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="*" className="hidden" />
              <button onClick={() => isLiveActive ? stopLiveMode() : startLiveMode()} className={`${isLiveActive ? 'text-ios-blue animate-pulse' : 'text-primary/40 dark:text-white/40'} p-1 transition-colors`}>
                <span className="material-symbols-outlined">graphic_eq</span>
              </button>
            </div>
          </div>
          <button onClick={() => handleSend()} disabled={isTyping || (!inputValue.trim() && !attachedFile)} className="bg-primary dark:bg-white w-11 h-11 rounded-full flex items-center justify-center text-white dark:text-black shadow-lg transition-all active:scale-90 disabled:opacity-30">
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatScreen;