import { describe, expect, it } from 'vitest';
import { createAudioEngine } from './engine.ts';
import { pitch } from './synth.ts';

describe('声音引擎', () => {
  it('用户还没操作过时没有设备：要出声的地方拿到的是 null，登记的事先等着', () => {
    const audio = createAudioEngine({ buses: ['effects', 'music'], volumes: { music: 0.5 } });
    let started = false;
    audio.whenReady(() => (started = true));
    expect(audio.context).toBeNull();
    expect(audio.output('effects')).toBeNull();
    expect(started).toBe(false);
    audio.dispose();
  });

  it('音量有默认值，改的时候夹在 0–1 之间', () => {
    const audio = createAudioEngine({ buses: ['effects', 'music'], volumes: { music: 0.5 } });
    expect(audio.volume('master')).toBe(1);
    expect(audio.volume('music')).toBe(0.5);
    audio.setVolume('music', 3);
    expect(audio.volume('music')).toBe(1);
    audio.setVolume('effects', -1);
    expect(audio.volume('effects')).toBe(0);
    audio.dispose();
  });
});

describe('音高', () => {
  it('往上十二个半音是高八度，七个半音是纯五度', () => {
    expect(pitch(220, 12)).toBeCloseTo(440, 10);
    expect(pitch(220, -12)).toBeCloseTo(110, 10);
    expect(pitch(220, 7)).toBeCloseTo(329.63, 1);
  });
});
