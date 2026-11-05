/**
 * Short sounds from oscillators. Nothing is fetched.
 * The context stays suspended until a click or an XR session resumes it.
 */
export class BoardAudio {
  private context: AudioContext | null = null;

  private contextOrNull(): AudioContext | null {
    const AudioCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioCtor) return null;
    this.context ??= new AudioCtor();
    return this.context;
  }

  resume(): void {
    const context = this.contextOrNull();
    if (context && context.state === 'suspended') void context.resume();
  }

  suspend(): void {
    if (this.context && this.context.state === 'running') void this.context.suspend();
  }

  /** Soft tick when a piece snaps to the next 15° step. */
  tick(): void {
    this.blip(740, 0.045, 'square', 0.04);
  }

  /** A short major chord when every target is lit. */
  win(): void {
    this.blip(523.25, 0.42, 'sine', 0.07);
    this.blip(659.25, 0.48, 'sine', 0.06, 0.04);
    this.blip(783.99, 0.55, 'sine', 0.05, 0.08);
  }

  private blip(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ): void {
    const context = this.contextOrNull();
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const amp = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(amp);
    amp.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
