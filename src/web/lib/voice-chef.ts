/**
 * AI Voice Sous Chef (Takolio V4)
 * Web Speech API for Vietnamese speech synthesis and hands-free voice commands,
 * featuring optional `"Tako ..."` wake-word & anchored-phrase filtering so casual
 * kitchen conversation never misfires step navigation.
 */

export type VoiceChefAction =
  | 'next'
  | 'prev'
  | 'repeat'
  | 'start_timer'
  | 'pause_timer'
  | 'extend_timer';

export interface VoiceListeningOptions {
  requireWakeWord?: boolean;
}

export interface VoiceCommandCallbacks {
  requireWakeWord?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  onRepeat?: () => void;
  onStartTimer?: () => void;
  onPauseTimer?: () => void;
  onExtendTimer?: () => void;
  onHeardCommand?: (text: string) => void;
  onMatchedAction?: (action: VoiceChefAction, text: string) => void;
  onError?: (err: any) => void;
}

const WAKE_WORD_PREFIX_REGEX =
  /^(?:hey\s+|ơi\s+|này\s+|ê\s+)?(?:tako\s+ơi|takolio\s+ơi|bếp\s+trưởng\s+ơi|bep\s+truong\s+oi|tako|ta\s+ko|takolio|bếp\s+trưởng|bep\s+truong)(?:[\s,.:;!-]+(.+))?$/i;

const ANCHORED_EXACT_COMMANDS: ReadonlyArray<readonly [VoiceChefAction, RegExp]> = [
  ['next', /^(?:bước tiếp theo|bước kế tiếp|chuyển bước tiếp|qua bước tiếp|next step)$/i],
  ['prev', /^(?:quay lại bước trước|lùi lại bước trước|quay về bước trước|previous step)$/i],
  ['repeat', /^(?:đọc lại bước này|nhắc lại bước này|đọc lại hướng dẫn|repeat step)$/i],
  ['start_timer', /^(?:bắt đầu hẹn giờ|bật hẹn giờ|bắt đầu bấm giờ|start timer)$/i],
  ['pause_timer', /^(?:tạm dừng hẹn giờ|dừng hẹn giờ|tạm dừng bấm giờ|pause timer)$/i],
  ['extend_timer', /^(?:thêm một phút|thêm 1 phút|gia hạn hẹn giờ)$/i],
];

function matchCommandPayload(text: string): VoiceChefAction | null {
  if (
    text.includes('thêm 1 phút') ||
    text.includes('thêm một phút') ||
    text.includes('thêm giờ') ||
    text.includes('gia hạn')
  ) {
    return 'extend_timer';
  }
  if (
    text.includes('tiếp') ||
    text.includes('kế tiếp') ||
    text.includes('xong') ||
    text.includes('next')
  ) {
    return 'next';
  }
  if (
    text.includes('lùi') ||
    text.includes('quay lại') ||
    text.includes('trước') ||
    text.includes('back')
  ) {
    return 'prev';
  }
  if (
    text.includes('đọc lại') ||
    text.includes('nói lại') ||
    text.includes('nhắc lại') ||
    text.includes('repeat')
  ) {
    return 'repeat';
  }
  if (
    text.includes('bấm giờ') ||
    text.includes('hẹn giờ') ||
    text.includes('bắt đầu') ||
    text.includes('timer')
  ) {
    return 'start_timer';
  }
  if (
    text.includes('dừng') ||
    text.includes('ngừng') ||
    text.includes('tạm dừng') ||
    text.includes('pause')
  ) {
    return 'pause_timer';
  }
  return null;
}

/**
 * Pure deterministic command matcher for Vietnamese hands-free cooking.
 * When `requireWakeWord` is enabled, casual kitchen chatter like `"cho tiếp nước vào"`
 * returns `null` unless prefixed with `"tako ..."` or spoken as an anchored exact phrase.
 */
export function matchVoiceChefCommand(
  rawTranscript: string,
  options?: VoiceListeningOptions,
): VoiceChefAction | null {
  const clean = rawTranscript
    .trim()
    .toLowerCase()
    .replace(/^[,.!?;:\s]+|[,.!?;:\s]+$/g, '')
    .replace(/\s+/g, ' ');

  if (!clean) return null;

  const wakeMatch = WAKE_WORD_PREFIX_REGEX.exec(clean);
  if (wakeMatch) {
    const payload = (wakeMatch[1] ?? '').trim();
    return payload ? matchCommandPayload(payload) : null;
  }

  for (const [action, pattern] of ANCHORED_EXACT_COMMANDS) {
    if (pattern.test(clean)) {
      return action;
    }
  }

  if (options?.requireWakeWord) {
    return null;
  }

  return matchCommandPayload(clean);
}

class VoiceSousChef {
  private isSpeaking = false;
  private recognition: any = null;
  private isListening = false;
  private defaultWakeWordMode = false;

  setWakeWordMode(enabled: boolean) {
    this.defaultWakeWordMode = Boolean(enabled);
  }

  getWakeWordMode(): boolean {
    return this.defaultWakeWordMode;
  }

  /**
   * Speak cooking step instruction in Vietnamese
   */
  speakInstruction(text: string, onEnd?: () => void): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select Vietnamese voice if available
      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find((v) => v.lang === 'vi-VN' || v.lang.startsWith('vi'));
      if (viVoice) {
        utterance.voice = viVoice;
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
   * Start listening for voice commands in Vietnamese
   */
  startListening(
    callbacks: VoiceCommandCallbacks,
    options?: VoiceListeningOptions,
  ): () => void {
    if (typeof window === 'undefined') return () => {};

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      if (callbacks.onError) {
        callbacks.onError(new Error('Trình duyệt chưa hỗ trợ nhận diện giọng nói Web Speech.'));
      }
      return () => {};
    }

    try {
      if (this.recognition) {
        this.recognition.stop();
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = true;
      recognition.interimResults = false;

      const requireWakeWord =
        options?.requireWakeWord ?? callbacks.requireWakeWord ?? this.defaultWakeWordMode;

      recognition.onresult = (event: any) => {
        if (this.recognition !== recognition || !this.isListening) return;
        const lastResult = event.results[event.results.length - 1];
        if (!lastResult || !lastResult[0]) return;

        const transcript = lastResult[0].transcript.trim().toLowerCase();
        if (callbacks.onHeardCommand) {
          callbacks.onHeardCommand(transcript);
        }

        const action = matchVoiceChefCommand(transcript, { requireWakeWord });
        if (!action) return;

        callbacks.onMatchedAction?.(action, transcript);

        switch (action) {
          case 'next':
            callbacks.onNext?.();
            break;
          case 'prev':
            callbacks.onPrev?.();
            break;
          case 'repeat':
            callbacks.onRepeat?.();
            break;
          case 'start_timer':
            callbacks.onStartTimer?.();
            break;
          case 'pause_timer':
            callbacks.onPauseTimer?.();
            break;
          case 'extend_timer':
            callbacks.onExtendTimer?.();
            break;
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
        // Auto-restart if user kept listening active
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
