
export class SpeechManager {
  private synthesis: SpeechSynthesis;
  private voicesLoaded: boolean = false;

  constructor() {
    this.synthesis = window.speechSynthesis;
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = () => this.loadVoices();
    }
    this.loadVoices();
  }

  loadVoices() {
    const voices = this.synthesis.getVoices();
    if (voices.length > 0) {
      this.voicesLoaded = true;
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
      if (!this.voicesLoaded) this.loadVoices();
      return this.synthesis.getVoices();
  }

  // Improved helper to find a high-quality female voice
  getFemaleVoice(): SpeechSynthesisVoice | undefined {
      const voices = this.getVoices();
      
      const priorities = [
          // 1. Chrome/Android High Quality
          (v: SpeechSynthesisVoice) => v.name === 'Google US English', 
          // 2. Edge Natural Voices
          (v: SpeechSynthesisVoice) => v.name.includes('Microsoft Aria'), 
          (v: SpeechSynthesisVoice) => v.name.includes('Natural') && v.name.includes('United States') && !v.name.includes('Male'),
          // 3. Windows Standard
          (v: SpeechSynthesisVoice) => v.name.includes('Zira'), 
          // 4. Mac Standard
          (v: SpeechSynthesisVoice) => v.name.includes('Samantha'), 
          // 5. iOS/Mac Enhanced
          (v: SpeechSynthesisVoice) => v.name.includes('Ava'),
          // 6. Generic Fallbacks
          (v: SpeechSynthesisVoice) => v.name.includes('Female'),
          (v: SpeechSynthesisVoice) => v.lang === 'en-US' && !v.name.includes('Male')
      ];

      for (const check of priorities) {
          const found = voices.find(check);
          if (found) return found;
      }
      
      // Final fallback: any non-male voice
      return voices.find(v => !v.name.toLowerCase().includes('male')) || voices[0];
  }

  // Improved helper to find a high-quality male voice
  getMaleVoice(): SpeechSynthesisVoice | undefined {
      const voices = this.getVoices();
      
      const priorities = [
          (v: SpeechSynthesisVoice) => v.name.includes('Google UK English Male'),
          (v: SpeechSynthesisVoice) => v.name.includes('Google US English Male'),
          (v: SpeechSynthesisVoice) => v.name.includes('David'), // Windows
          (v: SpeechSynthesisVoice) => v.name.includes('Daniel'), // Mac
          (v: SpeechSynthesisVoice) => v.name.includes('Male'),
          (v: SpeechSynthesisVoice) => v.lang === 'en-GB'
      ];

      for (const check of priorities) {
          const found = voices.find(check);
          if (found) return found;
      }
      return voices[0];
  }

  speak(text: string, options: { 
      voice?: SpeechSynthesisVoice, 
      rate?: number, 
      pitch?: number, 
      onStart?: () => void, 
      onEnd?: () => void 
  } = {}) {
    if (!this.voicesLoaded) this.loadVoices();

    this.synthesis.cancel(); // Stop previous

    const utterance = new SpeechSynthesisUtterance(text);
    
    if (options.voice) {
        utterance.voice = options.voice;
    }
    
    // Use provided options or sensible defaults
    utterance.rate = options.rate !== undefined ? options.rate : 1.0; 
    utterance.pitch = options.pitch !== undefined ? options.pitch : 1.0; 
    
    utterance.onstart = () => { if (options.onStart) options.onStart(); };
    utterance.onend = () => { if (options.onEnd) options.onEnd(); };
    utterance.onerror = (e) => { 
        console.error("Speech Error", e); 
        if (options.onEnd) options.onEnd(); 
    };
    
    this.synthesis.speak(utterance);
  }

  pause() { this.synthesis.pause(); }
  resume() { this.synthesis.resume(); }
  stop() { this.synthesis.cancel(); }
}

export const speechManager = new SpeechManager();
