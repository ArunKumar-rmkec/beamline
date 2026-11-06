/**
 * Short sounds from oscillators. Nothing is fetched.
 * The AudioContext is lazily created only on the first user interaction,
 * preventing audio engine startup during cold start.
 */
export class BoardAudio {
  private context: AudioContext | null = null;
  private interacted = false;
  private _lastWinChordAt = 0;
  private _chordsPlayed = 0;

  get lastWinChordAt(): number {
    return this._lastWinChordAt;
  }

  get chordsPlayed(): number {
    return this._chordsPlayed;
  }

  get contextState(): AudioContextState | 'uninitialized' {
    return this.context ? this.context.state : 'uninitialized';
  }

  interact(): void {
    this.interacted = true;
    void this.resume();
  }

  hasContext(): boolean {
    return this.context !== null;
  }

  private contextOrNull(): AudioContext | null {
    if (!this.interacted) return null;
    const AudioCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioCtor) return null;
    this.context ??= new AudioCtor();
    return this.context;
  }

  resume(): Promise<void> {
    if (!this.interacted) return Promise.resolve();
    const context = this.contextOrNull();
    if (context && context.state === 'suspended') {
      return context.resume();
    }
    return Promise.resolve();
  }

  suspend(): void {
    if (this.context && this.context.state === 'running') void this.context.suspend();
  }

  /** Soft tick when a piece snaps to the next 15° step. */
  tick(): void {
    this.interacted = true;
    const context = this.contextOrNull();
    if (!context) return;
    if (context.state === 'suspended') {
      void context.resume().then(() => {
        this.blip(context, 740, 0.045, 'square', 0.04);
      });
    } else {
      this.blip(context, 740, 0.045, 'square', 0.04);
    }
  }

  /** A short major chord when every target is lit. */
  win(): void {
    this.interacted = true;
    const context = this.contextOrNull();
    if (!context) return;
    if (context.state === 'suspended') {
      void context.resume().then(() => {
        this.scheduleWin(context);
      });
    } else {
      this.scheduleWin(context);
    }
  }

  private scheduleWin(context: AudioContext): void {
    this._chordsPlayed += 1;
    this._lastWinChordAt = performance.now();
    this.blip(context, 523.25, 0.42, 'sine', 0.07);
    this.blip(context, 659.25, 0.48, 'sine', 0.06, 0.04);
    this.blip(context, 783.99, 0.55, 'sine', 0.05, 0.08);
  }

  private blip(
    context: AudioContext,
    frequency: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ): void {
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
