/**
 * 电脑对手：和玩家一样，只看得到自己这一方能看到的状态，只通过命令行动。
 * 现在是几条最简单的规则，够让单人局里另一方动起来；做出像样的对手是之后的事。
 */
import { COSTS, MEASURE_BITS } from './outbreak.ts';
import type { Command, OutbreakView, Trait } from './types.ts';

const LOCKDOWN = MEASURE_BITS.lockdown;
/** 守方：一个地区的上报程度到这个数就封锁 */
const LOCK_ABOVE = 0.3;
/** 守方：封锁中的地区降到这个数以下就解封（解封不花钱） */
const RELEASE_BELOW = 0.06;

/** 看了这一方的状态之后要做的事；没有可做的返回 null */
export function decide(view: OutbreakView): Command | null {
  return view.attacker ? attack(view) : defend(view);
}

/** 攻方：攒够点数就强化。先把传播堆到 3 级，之后在隐蔽和症状之间挑等级低的 */
function attack(view: OutbreakView): Command | null {
  if (view.resource < COSTS.evolve) return null;
  const { transmission, severity, stealth } = view.traits;
  const trait: Trait =
    transmission < 3 ? 'transmission' : stealth <= severity ? 'stealth' : 'severity';
  return { type: 'evolve', trait };
}

/** 守方：先给降下来的地区解封，再封锁上报最重、还没封的那个 */
function defend(view: OutbreakView): Command | null {
  let hottest = -1;
  for (let region = 0; region < view.intensity.length; region++) {
    const locked = (view.measures[region]! & LOCKDOWN) !== 0;
    const level = view.intensity[region]!;
    if (locked && level < RELEASE_BELOW) {
      return { type: 'measure', region, measure: 'lockdown', on: false };
    }
    if (!locked && level >= LOCK_ABOVE && (hottest < 0 || level > view.intensity[hottest]!)) {
      hottest = region;
    }
  }
  if (hottest < 0 || view.resource < COSTS.measure) return null;
  return { type: 'measure', region: hottest, measure: 'lockdown', on: true };
}
