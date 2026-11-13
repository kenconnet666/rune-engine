/**
 * 声音引擎：管着声音设备（AudioContext）和几路音量。
 *
 * 浏览器不许页面一打开就出声：要等用户第一次点按或按键之后才能开声音设备。所以这里把“设备还没开”
 * 当成常态——还没开的时候所有出声的请求都悄悄不做，开了之后才接上；要常驻的声音（环境音、音乐）
 * 用 whenReady 登记，设备一开就起。
 *
 * 声音分几路（界面音、提示音、环境音、音乐……由使用方定），每一路一个音量，上面还有一个总音量。
 * 音量记在 localStorage 里。
 *
 *   const audio = createAudioEngine({ buses: ['effects', 'music'], storageKey: 'game:volume' });
 *   audio.whenReady((context) => startMusic(context, audio.output('music')!));
 *   const out = audio.output('effects');
 *   if (out) tone(out.context, out, { frequency: 880, duration: 0.05 });
 */

export interface AudioEngineOptions<Bus extends string> {
  /** 有哪几路 */
  readonly buses: readonly Bus[];
  /** 各路和总音量（'master'）一开始是多少（0–1），没写的是 1 */
  readonly volumes?: Partial<Record<Bus | 'master', number>>;
  /** 给了它就把音量记在 localStorage 的这个键下 */
  readonly storageKey?: string;
}

export interface AudioEngine<Bus extends string> {
  /** 声音设备；用户还没操作过、设备还没开时是 null */
  readonly context: AudioContext | null;
  /** 某一路的入口：要出声的东西接到它上面；设备还没开时是 null */
  output(bus: Bus): GainNode | null;
  /** 各路和总音量现在是多少 */
  volume(bus: Bus | 'master'): number;
  setVolume(bus: Bus | 'master', value: number): void;
  /** 设备开了之后做一件事；已经开了就马上做 */
  whenReady(run: (context: AudioContext) => void): void;
  dispose(): void;
}

/** 音量变化用这么长的时间滑过去，免得“咔”一声 */
const RAMP_SECONDS = 0.05;

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function createAudioEngine<Bus extends string>(
  options: AudioEngineOptions<Bus>,
): AudioEngine<Bus> {
  const { buses, storageKey } = options;
  type Channel = Bus | 'master';
  const channels: readonly Channel[] = ['master', ...buses];

  const volumes = new Map<Channel, number>(
    channels.map((channel) => [channel, options.volumes?.[channel] ?? 1]),
  );
  // 记住的音量盖过默认值；存的东西不对（别的版本、手改过）就不理它
  try {
    const saved = JSON.parse((storageKey && storage()?.getItem(storageKey)) || '{}') as Record<
      string,
      unknown
    >;
    for (const channel of channels) {
      const value = saved[channel];
      if (typeof value === 'number' && value >= 0 && value <= 1) volumes.set(channel, value);
    }
  } catch {
    // 存的不是 JSON：用默认值
  }

  let context: AudioContext | null = null;
  const gains = new Map<Channel, GainNode>();
  const waiting: ((context: AudioContext) => void)[] = [];

  /** 用户第一次操作：开设备，把各路接起来，做登记过的事 */
  const unlock = () => {
    if (context) return;
    context = new AudioContext();
    const master = context.createGain();
    master.gain.value = volumes.get('master')!;
    master.connect(context.destination);
    gains.set('master', master);
    for (const bus of buses) {
      const gain = context.createGain();
      gain.gain.value = volumes.get(bus)!;
      gain.connect(master);
      gains.set(bus, gain);
    }
    for (const run of waiting.splice(0)) run(context);
    stopListening();
  };
  const events = ['pointerdown', 'keydown'] as const;
  const stopListening = () => {
    for (const type of events) globalThis.removeEventListener?.(type, unlock, true);
  };
  for (const type of events) globalThis.addEventListener?.(type, unlock, true);

  return {
    get context() {
      return context;
    },
    output: (bus) => gains.get(bus) ?? null,
    volume: (channel) => volumes.get(channel) ?? 1,
    setVolume(channel, value) {
      const clamped = Math.min(1, Math.max(0, value));
      volumes.set(channel, clamped);
      const gain = gains.get(channel);
      if (gain && context) {
        gain.gain.setTargetAtTime(clamped, context.currentTime, RAMP_SECONDS);
      }
      if (storageKey) {
        storage()?.setItem(storageKey, JSON.stringify(Object.fromEntries(volumes)));
      }
    },
    whenReady(run) {
      if (context) run(context);
      else waiting.push(run);
    },
    dispose() {
      stopListening();
      void context?.close();
      context = null;
      gains.clear();
    },
  };
}
