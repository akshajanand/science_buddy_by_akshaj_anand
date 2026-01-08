export class SpeechManager {
  private synthesis: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  private voicesLoaded: boolean = false;

  constructor() {
    this.synthesis = window.speechSynthesis;
    // Attempt to load voices
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = () => this.loadVoice();
    }
    this.loadVoice();
  }

  loadVoice() {
    const voices = this.synthesis.getVoices();
    if (voices.length > 0) {
      this.voicesLoaded = true;
      // Prefer a clear English voice - Google US English is often good, or default local
      this.voice = voices.find(v => v.name.includes('Google US English')) || 
                   voices.find(v => v.lang === 'en-US') || 
                   voices[0];
    }
  }

  speak(text: string, onStart?: () => void, onEnd?: () => void) {
    if (!this.voicesLoaded) this.loadVoice();

    // Cancel any current speaking
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) utterance.voice = this.voice;
    
    // Tweaking for a slightly more friendly "tutor" tone if possible
    utterance.rate = 1.0; 
    utterance.pitch = 1.1; 
    
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

  stop() {
    this.synthesis.cancel();
  }
}

export const speechManager = new SpeechManager();