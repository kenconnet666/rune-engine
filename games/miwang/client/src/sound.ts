/**
 * 《迷惘》的声音，全部现场合成，不带音频文件。四路：
 *   ui        按钮的轻响
 *   alert     发生了事的提示音：波及新地区、上报病例、研究完成、事件、接种、分出胜负
 *   ambience  环境底噪：一层低沉的持续音，局势越紧它越亮、越不安
 *   music     音乐：稀疏的几个音，慢慢地走；局势紧了节奏加快、音阶里混进不协和的音
 *
 * “局势有多紧”（tension，0–1）由这一方看到的状态算：死亡离灾厄线多远、现在有多大比例的人在病。
 */
import type { NewsItem, NewsKind, OutbreakView } from '@miwang/sim';
import { createAudioEngine, noise, pitch, tone, type AudioEngine } from '@rune-engine/audio';

export type SoundBus = 'ui' | 'alert' | 'ambience' | 'music';
export type GameAudio = ReturnType<typeof createGameAudio>;

/** 音乐和底噪的基准音：A1 */
const ROOT = 55;
/** 平静时用的音（小调五声，半音数）；紧张时再混进去的两个不协和的音（小二度、三全音） */
const CALM_SCALE = [0, 3, 5, 7, 10, 12, 15, 17];
const TENSE_NOTES = [1, 6, 13];

type Play = (context: AudioContext, out: AudioNode) => void;

/** 各种一次性的声音怎么合成 */
const SOUNDS = {
  /** 按钮：一声很短的“嗒” */
  click: (context, out) =>
    tone(context, out, {
      frequency: 1500,
      endFrequency: 900,
      duration: 0.03,
      gain: 0.12,
      release: 0.04,
    }),
  /** 换到了性状、开始了研究：往上的两个音 */
  confirm: (context, out) => {
    const now = context.currentTime;
    tone(context, out, { type: 'triangle', frequency: 520, duration: 0.07, gain: 0.16 });
    tone(context, out, {
      type: 'triangle',
      frequency: 780,
      start: now + 0.08,
      duration: 0.1,
      gain: 0.16,
      release: 0.2,
    });
  },
  /** 波及新地区：一声低沉的声呐 */
  spread: (context, out) =>
    tone(context, out, {
      frequency: 330,
      endFrequency: 220,
      duration: 0.12,
      gain: 0.2,
      release: 0.9,
    }),
  /** 上报病例：高一些、短一些的一声 */
  report: (context, out) =>
    tone(context, out, { frequency: 660, duration: 0.05, gain: 0.14, release: 0.5 }),
  /** 研究完成：一个明亮的和弦 */
  research: (context, out) => {
    const now = context.currentTime;
    [0, 4, 7, 12].forEach((step, index) =>
      tone(context, out, {
        type: 'triangle',
        frequency: pitch(440, step),
        start: now + index * 0.06,
        duration: 0.25,
        gain: 0.1,
        release: 0.8,
      }),
    );
  },
  /** 开始接种：往上扫的一阵气流，接一个长音 */
  vaccine: (context, out) => {
    noise(context, out, {
      duration: 0.5,
      gain: 0.08,
      release: 0.4,
      filter: { type: 'bandpass', frequency: 500, endFrequency: 3000, q: 2 },
    });
    tone(context, out, {
      type: 'triangle',
      frequency: 660,
      start: context.currentTime + 0.3,
      duration: 0.5,
      gain: 0.12,
      release: 1.2,
    });
  },
  /** 事件：一声钟 */
  event: (context, out) => {
    tone(context, out, { frequency: 587, duration: 0.02, gain: 0.14, release: 1.1 });
    tone(context, out, { frequency: 1174, duration: 0.02, gain: 0.05, release: 0.7 });
  },
  /** 赢了：上行的大三和弦 */
  won: (context, out) => {
    const now = context.currentTime;
    [0, 4, 7, 12, 16].forEach((step, index) =>
      tone(context, out, {
        type: 'triangle',
        frequency: pitch(330, step),
        start: now + index * 0.14,
        duration: 0.5,
        gain: 0.13,
        release: 1.6,
      }),
    );
  },
  /** 输了：下行的几个低音 */
  lost: (context, out) => {
    const now = context.currentTime;
    [12, 8, 5, 0].forEach((step, index) =>
      tone(context, out, {
        type: 'sawtooth',
        frequency: pitch(110, step),
        start: now + index * 0.3,
        duration: 0.6,
        gain: 0.07,
        attack: 0.05,
        release: 1.8,
      }),
    );
  },
} satisfies Record<string, Play>;

export type SoundName = keyof typeof SOUNDS;

/** 新闻的种类各配哪个提示音（没配的不出声） */
const NEWS_SOUNDS: Partial<Record<NewsKind, SoundName>> = {
  spread: 'spread',
  report: 'report',
  evolve: 'confirm',
  research: 'research',
  vaccine: 'vaccine',
  traced: 'research',
  event: 'event',
};

/** 一次状态更新里最多响几个提示音：10 倍速时新闻一来一串，全响就成了噪音 */
const ALERTS_PER_UPDATE = 2;

const newsKey = (item: NewsItem) => `${item.tick}:${item.kind}:${item.region}:${item.subject}`;

/** 这一方看到的局势有多紧（0–1） */
export function tensionOf(view: OutbreakView): number {
  const { cases, population } = view.totals;
  const sick = population > 0 ? cases / population : 0;
  // 病着的人到 2% 就算很紧了；死亡离灾厄线的远近权重更大
  return Math.min(1, view.calamity * 0.7 + Math.min(1, sick / 0.02) * 0.5);
}

export function createGameAudio() {
  const engine: AudioEngine<SoundBus> = createAudioEngine({
    buses: ['ui', 'alert', 'ambience', 'music'],
    volumes: { master: 0.8, ui: 0.6, alert: 0.8, ambience: 0.5, music: 0.6 },
    storageKey: 'miwang:volume',
  });

  const play = (name: SoundName, bus: SoundBus = 'alert') => {
    const out = engine.output(bus);
    if (engine.context && out) SOUNDS[name](engine.context, out);
  };

  // 页面上任何一个按钮被点，都响一声“嗒”：不用每个按钮自己管
  const onClick = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('button:not(:disabled)')) {
      play('click', 'ui');
    }
  };
  document.addEventListener('click', onClick, true);

  let tension = 0;
  /** 在对局里（没暂停、没在菜单里）才有音乐；底噪一直在 */
  let playing = false;
  let musicTimer: ReturnType<typeof setTimeout> | undefined;
  let droneFilter: BiquadFilterNode | undefined;
  /** 音乐的旋律走到音阶的第几个音：每次随机地往上下挪一两步，听上去是在“走”而不是乱跳 */
  let step = 2;

  engine.whenReady((context) => {
    // 环境底噪：两个略微错开的锯齿波过低通，一直响着
    const out = engine.output('ambience')!;
    droneFilter = context.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 160;
    droneFilter.Q.value = 4;
    const level = context.createGain();
    level.gain.value = 0.16;
    for (const detune of [-7, 7]) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = ROOT;
      oscillator.detune.value = detune;
      oscillator.connect(droneFilter);
      oscillator.start();
    }
    // 很慢的起伏：像在呼吸
    const swell = context.createOscillator();
    const depth = context.createGain();
    swell.frequency.value = 0.07;
    depth.gain.value = 0.06;
    swell.connect(depth).connect(level.gain);
    swell.start();
    droneFilter.connect(level).connect(out);

    scheduleNote();
  });

  /** 放音乐的下一个音，再约好下一次 */
  function scheduleNote() {
    const { context } = engine;
    const out = engine.output('music');
    if (!context || !out) return;
    // 越紧张走得越快：从三秒多一个音到一秒半一个音
    const interval = 3.4 - 1.9 * tension;
    if (playing) {
      step = Math.min(CALM_SCALE.length - 1, Math.max(0, step + Math.round(Math.random() * 4 - 2)));
      const tense = Math.random() < tension * 0.5;
      const semitones = tense
        ? TENSE_NOTES[Math.floor(Math.random() * TENSE_NOTES.length)]!
        : CALM_SCALE[step]!;
      const frequency = pitch(ROOT * 4, semitones);
      const start = context.currentTime + 0.05;
      // 一个柔和的长音：正弦加一点高八度的三角波
      tone(context, out, { frequency, start, duration: 0.6, gain: 0.1, attack: 0.5, release: 2.6 });
      tone(context, out, {
        type: 'triangle',
        frequency: frequency * 2,
        start,
        duration: 0.3,
        gain: 0.025,
        attack: 0.6,
        release: 2,
      });
      // 紧张起来之后底下加一下一下的低音，像心跳
      if (tension > 0.45) {
        tone(context, out, {
          frequency: ROOT * 1.5,
          endFrequency: ROOT,
          start,
          duration: 0.08,
          gain: 0.22 * tension,
          release: 0.35,
        });
      }
    }
    musicTimer = setTimeout(scheduleNote, interval * 1000);
  }

  let lastNews = '';
  let lastOutcome = false;

  return {
    engine,
    play,
    /**
     * 每来一份新的状态叫一次：按新出现的新闻响提示音，按局势调底噪和音乐。
     * inGame 为假（在菜单里、暂停着）时音乐停下，只留底噪。
     */
    update(view: OutbreakView | null, inGame: boolean) {
      playing = inGame && view != null && !view.outcome;
      if (!view) return;
      tension = tensionOf(view);
      if (droneFilter && engine.context) {
        // 越紧张底噪越亮：低通的截止频率从 160 赫兹开到 900 赫兹
        droneFilter.frequency.setTargetAtTime(160 + 740 * tension, engine.context.currentTime, 1.5);
      }

      // 上次看到的最后一条之后新出现的新闻
      const keys = view.news.map(newsKey);
      const seen = keys.lastIndexOf(lastNews);
      const fresh = lastNews === '' ? [] : view.news.slice(seen + 1);
      lastNews = keys.at(-1) ?? lastNews;
      for (const item of fresh.slice(-ALERTS_PER_UPDATE)) {
        const sound = NEWS_SOUNDS[item.kind];
        if (sound) play(sound);
      }

      const over = view.outcome != null;
      if (over && !lastOutcome) play(view.outcome!.winner === view.player ? 'won' : 'lost');
      lastOutcome = over;
    },
    dispose() {
      document.removeEventListener('click', onClick, true);
      clearTimeout(musicTimer);
      engine.dispose();
    },
  };
}
