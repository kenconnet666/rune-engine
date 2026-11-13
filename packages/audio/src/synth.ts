/**
 * 现场合成声音用的基本件：一个音（振荡器加音量包络）、一阵噪声（白噪声过滤波器）。
 * 所有声音都是“排进时间表”的：给出什么时候开始、多长，浏览器的声音线程到点自己放，不受主线程卡不卡的影响。
 * 放完的节点自己断开、被回收，不用管。
 */

export interface ToneOptions {
  /** 波形，默认正弦 */
  type?: OscillatorType;
  /** 音高（赫兹）；给了 endFrequency 就在这段时间里滑过去 */
  frequency: number;
  endFrequency?: number;
  /** 什么时候开始（context.currentTime 的那个钟），默认现在 */
  start?: number;
  /** 持续多久（秒），不含尾音 */
  duration: number;
  /** 最响的时候多响（0–1），默认 0.2 */
  gain?: number;
  /** 起音、尾音各多长（秒）：起音太短会“咔”一声，尾音决定是脆还是绵 */
  attack?: number;
  release?: number;
  /** 音高偏移（音分）：两个略微错开的音叠在一起会变厚 */
  detune?: number;
}

/** 音量包络：从 0 起来、保持、落回 0；返回声音彻底结束的时刻 */
function envelope(
  gain: GainNode,
  start: number,
  duration: number,
  peak: number,
  attack: number,
  release: number,
): number {
  const hold = Math.max(start + attack, start + duration);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.setValueAtTime(peak, hold);
  // 指数衰减不能到 0：落到听不见的地方为止
  gain.gain.exponentialRampToValueAtTime(0.0001, hold + release);
  return hold + release;
}

/** 放一个音 */
export function tone(context: AudioContext, output: AudioNode, options: ToneOptions): void {
  const {
    type = 'sine',
    frequency,
    endFrequency,
    start = context.currentTime,
    duration,
    gain: peak = 0.2,
    attack = 0.005,
    release = 0.08,
    detune = 0,
  } = options;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.detune.value = detune;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
  }
  const end = envelope(gain, start, duration, peak, attack, release);
  oscillator.connect(gain).connect(output);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

export interface NoiseOptions {
  start?: number;
  duration: number;
  gain?: number;
  attack?: number;
  release?: number;
  /** 滤波：低通让它闷，带通让它像风、像气流；给了 endFrequency 就扫过去 */
  filter?: { type: BiquadFilterType; frequency: number; endFrequency?: number; q?: number };
}

/** 每个声音设备一段一秒的白噪声，反复用 */
const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

function noiseBuffer(context: AudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(context);
  if (!buffer) {
    buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    noiseBuffers.set(context, buffer);
  }
  return buffer;
}

/** 放一阵噪声 */
export function noise(context: AudioContext, output: AudioNode, options: NoiseOptions): void {
  const {
    start = context.currentTime,
    duration,
    gain: peak = 0.1,
    attack = 0.01,
    release = 0.1,
    filter,
  } = options;
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  source.loop = true;
  const gain = context.createGain();
  const end = envelope(gain, start, duration, peak, attack, release);
  let last: AudioNode = source;
  if (filter) {
    const node = context.createBiquadFilter();
    node.type = filter.type;
    node.Q.value = filter.q ?? 1;
    node.frequency.setValueAtTime(filter.frequency, start);
    if (filter.endFrequency !== undefined) {
      node.frequency.exponentialRampToValueAtTime(Math.max(1, filter.endFrequency), end);
    }
    last = last.connect(node);
  }
  last.connect(gain).connect(output);
  source.start(start);
  source.stop(end + 0.02);
}

/** 十二平均律：从一个基准音高往上数 semitones 个半音是多少赫兹 */
export function pitch(base: number, semitones: number): number {
  return base * 2 ** (semitones / 12);
}
