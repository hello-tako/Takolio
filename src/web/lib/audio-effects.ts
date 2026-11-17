/**
 * Web Audio API Harmonic Marimba & Singing-Bowl Kitchen Chimes (Takolio V4)
 * Zero external audio files, works 100% offline, warm acoustic overtones.
 */

class SoundEffectManager {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Synthesizes a single warm singing-bowl / rosewood marimba tone with natural harmonic partials.
   */
  private playHarmonicVoice(
    ctx: AudioContext,
    fundamentalHz: number,
    startTime: number,
    durationSec: number,
    peakGain = 0.22,
    timbre: 'singing_bowl' | 'marimba' = 'singing_bowl',
  ) {
    const partials: Array<{ ratio: number; amp: number; decayScale: number; type: OscillatorType }> =
      timbre === 'singing_bowl'
        ? [
            { ratio: 1.0, amp: 1.0, decayScale: 1.0, type: 'sine' },
            { ratio: 2.0, amp: 0.35, decayScale: 0.72, type: 'sine' },
            { ratio: 2.756, amp: 0.18, decayScale: 0.55, type: 'sine' },
          ]
        : [
            { ratio: 1.0, amp: 1.0, decayScale: 1.0, type: 'sine' },
            { ratio: 3.98, amp: 0.28, decayScale: 0.38, type: 'triangle' },
          ];

    for (const partial of partials) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const partialDuration = Math.max(0.04, durationSec * partial.decayScale);
      const amp = peakGain * partial.amp;

      osc.type = partial.type;
      osc.frequency.setValueAtTime(fundamentalHz * partial.ratio, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(amp, startTime + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0008, startTime + partialDuration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + partialDuration + 0.01);
    }
  }

  /**
   * Warm singing-bowl three-phrase kitchen timer completion chime (D5 -> A5 -> F#5 -> D6).
   */
  playTimerCompleteChime() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Phrase 1: gentle attention call
      this.playHarmonicVoice(ctx, 587.33, now, 0.75, 0.22, 'singing_bowl'); // D5
      this.playHarmonicVoice(ctx, 880.0, now + 0.18, 0.9, 0.2, 'singing_bowl'); // A5

      // Phrase 2: warm resonance echo
      this.playHarmonicVoice(ctx, 739.99, now + 0.78, 0.75, 0.2, 'singing_bowl'); // F#5
      this.playHarmonicVoice(ctx, 1174.66, now + 0.96, 1.15, 0.22, 'singing_bowl'); // D6
    } catch {
      // Ignore audio errors in restricted environments
    }
  }

  /**
   * Crisp wooden marimba tick when advancing or stepping through recipe cards.
   */
  playStepAdvanceTick() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      this.playHarmonicVoice(ctx, 523.25, now, 0.085, 0.14, 'marimba'); // C5
      this.playHarmonicVoice(ctx, 783.99, now + 0.03, 0.095, 0.11, 'marimba'); // G5
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Uplifting Cmaj9 acoustic arpeggio + singing-bowl bloom when finishing a meal or Mâm Cơm.
   */
  playCookingCelebrationChord() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 987.77, 1174.66]; // C5, E5, G5, B5, D6
      notes.forEach((freq, idx) => {
        this.playHarmonicVoice(
          ctx,
          freq,
          now + idx * 0.09,
          0.95 + idx * 0.08,
          0.18,
          idx === notes.length - 1 ? 'singing_bowl' : 'marimba',
        );
      });
    } catch {
      // Ignore audio errors
    }
  }

  // Backward-compatible aliases for existing V1-V3 callers
  playTimerAlertSound() {
    this.playTimerCompleteChime();
  }

  playStepClickSound() {
    this.playStepAdvanceTick();
  }

  playSuccessChime() {
    this.playCookingCelebrationChord();
  }
}

export const audioEffects = new SoundEffectManager();

export function playTimerCompleteChime(): void {
  audioEffects.playTimerCompleteChime();
}

export function playStepAdvanceTick(): void {
  audioEffects.playStepAdvanceTick();
}

export function playCookingCelebrationChord(): void {
  audioEffects.playCookingCelebrationChord();
}
