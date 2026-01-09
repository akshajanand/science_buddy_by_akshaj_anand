
export class SpeechManager {
  private synthesis: SpeechSynthesis;
  private defaultVoice: SpeechSynthesisVoice | null = null;
  private voicesLoaded: boolean = false;

  constructor() {
    this.synthesis = window.speechSynthesis;
    // Attempt to load voices
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = () => this.loadVoices();
    }
    this.loadVoices();
  }

  loadVoices() {
    const voices = this.synthesis.getVoices();
    if (voices.length > 0) {
      this.voicesLoaded = true;
      // Prefer a clear English voice - Google US English is often good, or default local
      this.defaultVoice = voices.find(v => v.name.includes('Google US English')) || 
                   voices.find(v => v.lang === 'en-US') || 
                   voices[0];
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
      if (!this.voicesLoaded) this.loadVoices();
      return this.synthesis.getVoices();
  }

  speak(text: string, onStart?: () => void, onEnd?: () => void, specificVoice?: SpeechSynthesisVoice) {
    if (!this.voicesLoaded) this.loadVoices();

    // Cancel any current speaking
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (specificVoice) {
        utterance.voice = specificVoice;
    } else if (this.defaultVoice) {
        utterance.voice = this.defaultVoice;
    }
    
    // Tweaking for a slightly more friendly "tutor" tone if possible
    utterance.rate = 1.0; 
    utterance.pitch = 1.0; 
    
    utterance.onstart = () => {
      if (onStart) onStart();
    };

    utterance.onend = () => {
      if (onEnd) onEnd();
    };
    
    utterance.onerror = (e) => {
        console.error("Speech Error", e);
        if (onEnd) onEnd();
    };
    
    this.synthesis.speak(utterance);
  }

  pause() {
      this.synthesis.pause();
  }

  resume() {
      this.synthesis.resume();
  }

  stop() {
    this.synthesis.cancel();
  }
}

export const speechManager = new SpeechManager();