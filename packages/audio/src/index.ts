/** 声音：设备解锁与分路音量（engine），现场合成用的基本件（synth）。只能在主线程用 */
export { createAudioEngine, type AudioEngine, type AudioEngineOptions } from './engine.ts';
export { noise, pitch, tone, type NoiseOptions, type ToneOptions } from './synth.ts';
