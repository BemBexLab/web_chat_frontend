// Play a bell notification sound when new message arrives
let __audioContext: AudioContext | null = null;
let __resumeListenerAdded = false;
let __audioEl: HTMLAudioElement | null = null;

const getAudioContext = () => {
  // Do NOT create AudioContext here to avoid autoplay warnings; only return existing one.
  return __audioContext;
};

const createAudioContext = () => {
  if (__audioContext) return __audioContext;
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  __audioContext = new AudioCtx();
  return __audioContext;
};

export const playNotificationSound = async () => {
  try {
    const audioContext = getAudioContext();
    if (!audioContext) {
      console.warn('Web Audio API not available');
      // Try HTMLAudio fallback
      const el = getFallbackAudioElement();
      try { await el.play(); } catch (_) { /* ignore autoplay errors */ }
      return;
    }

    // Try resuming if suspended (may require user gesture)
    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (err) {
        // resume may fail if no gesture; exit silently
        console.warn('AudioContext resume failed:', err);
        return;
      }
    }

    // If still not running, try HTMLAudio fallback to avoid start() throwing under autoplay rules
    if (audioContext.state !== 'running') {
      const el = getFallbackAudioElement();
      try { await el.play(); } catch (_) { /* ignore autoplay errors */ }
      return;
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Bell sound parameters
    const now = audioContext.currentTime;
    oscillator.frequency.setValueAtTime(800, now);
    oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.08);

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    oscillator.type = 'sine';
    oscillator.start(now);
    oscillator.stop(now + 0.35);
  } catch (error) {
    // Avoid spamming console with autoplay errors (they are expected until user gesture)
    // Log only unexpected errors
    if (error && typeof error === 'object' && 'name' in (error as any) && (error as any).name === 'NotAllowedError') {
      // suppressed autoplay error
    } else {
      console.warn('Could not play notification sound:', error);
    }
  }
};

const getFallbackAudioElement = () => {
  if (__audioEl) return __audioEl;
  // Prefer a file at /f1_radio.mp3 (place your sound in the Next `public/` folder as f1_radio.mp3)
  // Fallback to a very small embedded WAV if that file is missing or cannot play.
  const el = new Audio('/f1_radio.mp3');
  el.preload = 'auto';
  // If the external file fails to load, use a tiny embedded beep as fallback
  el.addEventListener('error', () => {
    try {
      const dataURI = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=';
      el.src = dataURI;
      el.load();
    } catch (e) {
      // ignore
    }
  });
  __audioEl = el;
  return el;
};

// Try to resume/create AudioContext on user gesture. Returns true if unlocked.
export const unlockAudio = async (): Promise<boolean> => {
  try {
    let audioContext = getAudioContext();
    if (!audioContext) {
      audioContext = createAudioContext();
    }
    if (!audioContext) return false;
    // capture current state once; narrowing this variable doesn't affect
    // audioContext.state later (which can change after resume)
    let state = audioContext.state;
    if (state === 'running') return true;
    try {
      await audioContext.resume();
      // now read the live state again; audioContext.state hasn't been narrowed
      return audioContext.state === 'running';
    } catch (e) {
      // If resume fails, attach one-time listeners to resume on next gesture
      return new Promise<boolean>((resolve) => {
        const resume = async () => {
          try {
            await audioContext!.resume();
            resolve(audioContext!.state === 'running');
          } catch (_err) {
            resolve(false);
          } finally {
            document.removeEventListener('pointerdown', resume);
            document.removeEventListener('click', resume);
            document.removeEventListener('keydown', resume);
          }
        };
        document.addEventListener('pointerdown', resume, { once: true });
        document.addEventListener('click', resume, { once: true });
        document.addEventListener('keydown', resume, { once: true });
      });
    }
  } catch (err) {
    console.warn('unlockAudio failed', err);
    return false;
  }
};
