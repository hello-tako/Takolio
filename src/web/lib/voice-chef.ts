/**
 * Multilingual AI Voice Sous-Chef (`vi-VN`, `ja-JP`, `en-GB`, `de-DE`, `fr-FR`)
 * Web Speech API for localized cooking step synthesis and hands-free voice commands,
 * synced automatically with `LocaleContext` or explicit locale overrides.
 */
import { LOCALE_CATALOG } from '../../shared/locales';
import { getActiveAppLocale } from '../i18n/LocaleContext';

export type VoiceChefLocale = 'vi' | 'en' | 'ja' | 'de' | 'fr';

export interface VoiceCommandCallbacks {
  onNext?: () => void;
  onPrev?: () => void;
  onRepeat?: () => void;
  onStartTimer?: () => void;
  onPauseTimer?: () => void;
  onHeardCommand?: (text: string) => void;
  onError?: (err: any) => void;
}

interface VoiceLocaleProfile {
  bcp47: string;
  voicePrefix: string;
  unsupportedError: string;
  keywords: {
    next: readonly string[];
    prev: readonly string[];
    repeat: readonly string[];
    startTimer: readonly string[];
    pauseTimer: readonly string[];
  };
}

export const VOICE_LOCALE_PROFILES: Readonly<Record<VoiceChefLocale, VoiceLocaleProfile>> = Object.freeze({
  vi: {
    bcp47: 'vi-VN',
    voicePrefix: 'vi',
    unsupportedError: 'Trình duyệt chưa hỗ trợ nhận diện giọng nói Web Speech.',
    keywords: {
      next: ['tiếp', 'kế tiếp', 'xong', 'next'],
      prev: ['lùi', 'quay lại', 'trước', 'back'],
      repeat: ['đọc lại', 'nói lại', 'nhắc lại', 'repeat'],
      startTimer: ['bấm giờ', 'hẹn giờ', 'bắt đầu', 'timer'],
      pauseTimer: ['dừng', 'ngừng', 'tạm dừng', 'pause'],
    },
  },
  ja: {
    bcp47: 'ja-JP',
    voicePrefix: 'ja',
    unsupportedError: 'お使いのブラウザは音声認識に対応していません。',
    keywords: {
      next: ['次へ', '次の', '進んで', '完了', 'つぎ'],
      prev: ['戻る', '前へ', '前の', 'もどる'],
      repeat: ['もう一回', 'もう一度', '繰り返し', '読んで'],
      startTimer: ['タイマー開始', 'タイマー', 'スタート'],
      pauseTimer: ['一時停止', 'ストップ', '止めて', 'ポーズ'],
    },
  },
  en: {
    bcp47: 'en-GB',
    voicePrefix: 'en',
    unsupportedError: 'Your browser does not support Web Speech recognition.',
    keywords: {
      next: ['next', 'continue', 'done', 'forward'],
      prev: ['back', 'previous', 'go back'],
      repeat: ['repeat', 'read again', 'say again'],
      startTimer: ['start timer', 'timer', 'begin timer'],
      pauseTimer: ['pause', 'stop timer', 'hold timer'],
    },
  },
  de: {
    bcp47: 'de-DE',
    voicePrefix: 'de',
    unsupportedError: 'Ihr Browser unterstützt keine Web-Spracherkennung.',
    keywords: {
      next: ['weiter', 'nächster', 'fertig'],
      prev: ['zurück', 'vorheriger'],
      repeat: ['wiederholen', 'nochmal', 'vorlesen'],
      startTimer: ['timer starten', 'timer', 'uhr starten'],
      pauseTimer: ['pause', 'pausieren', 'anhalten', 'stopp'],
    },
  },
  fr: {
    bcp47: 'fr-FR',
    voicePrefix: 'fr',
    unsupportedError: 'Votre navigateur ne prend pas en charge la reconnaissance vocale.',
    keywords: {
      next: ['suivant', 'continuer', 'terminé'],
      prev: ['retour', 'précédent', 'arrière'],
      repeat: ['répéter', 'relire', 'encore'],
      startTimer: ['minuteur', 'démarrer', 'lancer'],
      pauseTimer: ['pause', 'arrêter', 'suspendre'],
    },
  },
});

function resolveVoiceLocale(locale?: string): VoiceChefLocale {
  const short = (locale || '').trim().toLowerCase().split(/[-_]/)[0];
  if (short === 'ja' || short === 'en' || short === 'de' || short === 'fr' || short === 'vi') {
    return short;
  }
  return 'vi';
}

export class VoiceSousChef {
  private isSpeaking = false;
  private recognition: any = null;
  private isListening = false;
  private activeLocale: VoiceChefLocale = 'vi';
  private explicitLocaleSet = false;

  setLocale(locale: VoiceChefLocale | string): VoiceChefLocale {
    this.activeLocale = resolveVoiceLocale(locale);
    this.explicitLocaleSet = true;
    return this.activeLocale;
  }

  getLocale(): VoiceChefLocale {
    return this.explicitLocaleSet ? this.activeLocale : resolveVoiceLocale(getActiveAppLocale());
  }

  private resolveTargetSpeech(locale?: VoiceChefLocale | string): {
    profile: VoiceLocaleProfile;
    speechLang: string;
    langPrefix: string;
  } {
    if (locale) {
      const resolved = resolveVoiceLocale(locale);
      const profile = VOICE_LOCALE_PROFILES[resolved];
      return { profile, speechLang: profile.bcp47, langPrefix: profile.voicePrefix };
    }
    if (this.explicitLocaleSet) {
      const profile = VOICE_LOCALE_PROFILES[this.activeLocale];
      return { profile, speechLang: profile.bcp47, langPrefix: profile.voicePrefix };
    }
    const appLoc = getActiveAppLocale();
    const profile = VOICE_LOCALE_PROFILES[resolveVoiceLocale(appLoc)];
    const speechLang = LOCALE_CATALOG[appLoc]?.speechLang ?? profile.bcp47;
    return { profile, speechLang, langPrefix: speechLang.split('-')[0].toLowerCase() };
  }

  /**
   * Speak cooking step instruction in the active (or specified) locale.
   */
  speakInstruction(text: string, onEnd?: () => void, locale?: VoiceChefLocale | string): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }

    try {
      window.speechSynthesis.cancel();
      const { speechLang, langPrefix } = this.resolveTargetSpeech(locale);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLang;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find(
        (v) => v.lang === speechLang || v.lang.toLowerCase().startsWith(langPrefix),
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onstart = () => {
        this.isSpeaking = true;
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        if (onEnd) onEnd();
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }

  stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }

  getSpeakingStatus(): boolean {
    return this.isSpeaking;
  }

  /**
   * Start listening for hands-free voice commands in the active (or specified) locale.
   */
  startListening(callbacks: VoiceCommandCallbacks, locale?: VoiceChefLocale | string): () => void {
    if (typeof window === 'undefined') return () => {};

    const { profile, speechLang } = this.resolveTargetSpeech(locale);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      if (callbacks.onError) {
        callbacks.onError(new Error(profile.unsupportedError));
      }
      return () => {};
    }

    try {
      if (this.recognition) {
        this.recognition.stop();
      }

      const recognition = new SpeechRecognition();
      recognition.lang = speechLang;
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        if (this.recognition !== recognition || !this.isListening) return;
        const lastResult = event.results[event.results.length - 1];
        if (!lastResult || !lastResult[0]) return;

        const transcript = String(lastResult[0].transcript).trim().toLowerCase();
        if (callbacks.onHeardCommand) {
          callbacks.onHeardCommand(transcript);
        }

        const matchesAny = (list: readonly string[]) =>
          list.some((kw) => transcript.includes(kw.toLowerCase()));

        if (matchesAny(profile.keywords.next)) {
          callbacks.onNext?.();
        } else if (matchesAny(profile.keywords.prev)) {
          callbacks.onPrev?.();
        } else if (matchesAny(profile.keywords.repeat)) {
          callbacks.onRepeat?.();
        } else if (matchesAny(profile.keywords.pauseTimer)) {
          callbacks.onPauseTimer?.();
        } else if (matchesAny(profile.keywords.startTimer)) {
          callbacks.onStartTimer?.();
        }
      };

      recognition.onerror = (event: any) => {
        if (this.recognition !== recognition) return;
        if (event.error !== 'no-speech') {
          console.warn('Speech recognition event:', event.error);
          if (this.isListening) {
            this.isListening = false;
            callbacks.onError?.(event);
          }
        }
      };

      recognition.onend = () => {
        if (this.isListening && this.recognition === recognition) {
          try {
            recognition.start();
          } catch {
            // Ignore
          }
        }
      };

      this.recognition = recognition;
      this.isListening = true;
      recognition.start();

      return () => {
        if (this.recognition !== recognition) return;
        this.isListening = false;
        if (this.recognition) {
          try {
            this.recognition.stop();
          } catch {
            // Ignore
          }
          this.recognition = null;
        }
      };
    } catch (err) {
      this.stopListening();
      if (callbacks.onError) callbacks.onError(err);
      return () => {};
    }
  }

  stopListening() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
      this.recognition = null;
    }
  }
}

export const voiceChef = new VoiceSousChef();
