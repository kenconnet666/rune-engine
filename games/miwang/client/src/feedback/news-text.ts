/**
 * 一条新闻写成一句话。新闻面板和结算时的大事记都用它。
 * 要在组件的渲染函数里调（它读当前语言的文案，切换语言时跟着重画）。
 */
import { CALENDAR } from '@miwang/content';
import type { NewsItem } from '@miwang/sim';
import { placeName, useContent, useFormats, useUi } from '../i18n.ts';

/** subject 写成“甲.乙”的那几种（抉择是“事.选项”，任务是“任务.结果”，里程碑是“哪条线.到了多少”） */
const split = (subject: string): [string, string] => {
  const at = subject.indexOf('.');
  return at < 0 ? [subject, ''] : [subject.slice(0, at), subject.slice(at + 1)];
};

/** attacker 是看的人是不是攻方：同一件事对两边的说法不一样（“获得性状”和“病原体出现新的性状”） */
export function newsSentence(item: NewsItem, attacker: boolean): string {
  const all = useUi();
  const ui = all.news;
  const content = useContent();
  const place = item.region >= 0 ? placeName(item.region) : '';
  switch (item.kind) {
    case 'spread':
      return ui.spread(place);
    case 'report':
      return ui.report(place);
    case 'evolve': {
      const name = content.traits[item.subject]?.name ?? item.subject;
      return attacker ? ui.evolved(name) : ui.evolvedSeen(name);
    }
    case 'synergy': {
      const name = content.synergies[item.subject]?.name ?? item.subject;
      return attacker ? ui.synergy(name) : ui.synergySeen(name);
    }
    case 'devolve': {
      const name = content.traits[item.subject]?.name ?? item.subject;
      return attacker ? ui.devolved(name) : ui.devolvedSeen(name);
    }
    case 'research':
      return ui.research(content.techs[item.subject]?.name ?? item.subject);
    case 'vaccine':
      return ui.vaccine;
    case 'traced':
      return ui.traced(place);
    case 'event': {
      const name = content.events[item.subject]?.name ?? item.subject;
      return place ? ui.eventAt(place, name) : name;
    }
    case 'team':
      return ui.team(place);
    case 'briefing':
      return ui.briefing;
    case 'skill': {
      const name = content.skills[item.subject]?.name ?? item.subject;
      return place ? ui.skillAt(place, name) : ui.skill(name);
    }
    case 'decision': {
      const [id, option] = split(item.subject);
      const text = content.decisions[id];
      const [name, chosen] = [text?.name ?? id, text?.options[option] ?? option];
      return place ? ui.decisionAt(place, name, chosen) : ui.decision(name, chosen);
    }
    case 'task': {
      const [id, result] = split(item.subject);
      const name = content.tasks[id]?.name ?? id;
      return result === 'done' ? ui.taskDone(name) : ui.taskFailed(name);
    }
    case 'milestone': {
      const [line, mark] = split(item.subject);
      if (line === 'regions') return all.alerts.regions(Number(mark));
      if (line === 'calamity') return all.alerts.calamity(useFormats().percent(Number(mark) / 100));
      return all.alerts.firstDeath;
    }
    case 'calendar': {
      const [id, phase] = split(item.subject);
      const name = content.calendar[id]?.name ?? id;
      if (phase === 'begin')
        return place ? ui.calendarBeginAt(place, name) : ui.calendarBegin(name);
      const days = CALENDAR.find((def) => def.id === id)?.notice ?? 0;
      return place ? ui.calendarSoonAt(place, name, days) : ui.calendarSoon(name, days);
    }
    case 'outcome':
      return content.outcomes[item.subject as keyof typeof content.outcomes] ?? item.subject;
  }
}
