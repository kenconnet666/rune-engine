import { describe, expect, it } from 'vitest';
import { CHAPTER_IDS, CHAPTERS } from '../tables/chapters.ts';
import { CREDITS } from '../tables/credits.ts';
import { DECISIONS } from '../tables/decisions.ts';
import { CALENDAR } from '../tables/calendar.ts';
import { CONDITIONS } from '../tables/conditions.ts';
import { EVENTS } from '../tables/events.ts';
import { PATHOGENS, SOURCES } from '../tables/pathogens.ts';
import { SKILLS } from '../tables/skills.ts';
import { TASKS } from '../tables/tasks.ts';
import { TECHS } from '../tables/techs.ts';
import { TRAITS } from '../tables/traits.ts';
import { CONTENT_TEXT } from './index.ts';

const ids = (items: readonly { readonly id: string }[]) => items.map((item) => item.id).sort();

describe('内容的文案', () => {
  for (const [locale, text] of Object.entries(CONTENT_TEXT)) {
    it(`${locale}：表里的每一项都有名字和说明，也没有多出来的`, () => {
      expect(Object.keys(text.traits).sort()).toEqual(ids(TRAITS));
      expect(Object.keys(text.techs).sort()).toEqual(ids(TECHS));
      expect(Object.keys(text.events).sort()).toEqual(ids(EVENTS));
      expect(Object.keys(text.calendar).sort()).toEqual(ids(CALENDAR));
      expect(Object.keys(text.conditions).sort()).toEqual(ids(CONDITIONS));
      expect(Object.keys(text.skills).sort()).toEqual(ids(SKILLS));
      expect(Object.keys(text.tasks).sort()).toEqual(ids(TASKS));
      expect(Object.keys(text.decisions).sort()).toEqual(ids(DECISIONS));
      for (const decision of DECISIONS) {
        const words = text.decisions[decision.id]!;
        expect(words.name.length * words.detail.length, decision.id).toBeGreaterThan(0);
        expect(Object.keys(words.options).sort(), decision.id).toEqual(ids(decision.options));
      }
      expect(Object.keys(text.pathogens).sort()).toEqual(ids(PATHOGENS));
      expect(Object.keys(text.chapters).sort()).toEqual([...CHAPTER_IDS].sort());
      expect(Object.keys(text.credits).sort()).toEqual(
        Object.values(CREDITS)
          .flat()
          .map((credit) => credit.id)
          .sort(),
      );
      for (const group of [
        text.traits,
        text.techs,
        text.events,
        text.calendar,
        text.conditions,
        text.skills,
        text.tasks,
        text.measures,
      ]) {
        for (const label of Object.values(group)) {
          expect(label.name.length).toBeGreaterThan(0);
          expect(label.detail.length).toBeGreaterThan(0);
        }
      }
    });
  }
});

describe('性状表与科技表', () => {
  it('前置都指向表里有的项', () => {
    const traits = new Set(ids(TRAITS));
    for (const trait of TRAITS) {
      for (const id of trait.requires) expect(traits.has(id), `${trait.id} → ${id}`).toBe(true);
    }
    const techs = new Set(ids(TECHS));
    for (const tech of TECHS) {
      for (const id of tech.requires) expect(techs.has(id), `${tech.id} → ${id}`).toBe(true);
    }
  });

  it('id 不重复', () => {
    expect(new Set(ids(TRAITS)).size).toBe(TRAITS.length);
    expect(new Set(ids(TECHS)).size).toBe(TECHS.length);
    expect(new Set(ids(EVENTS)).size).toBe(EVENTS.length);
    expect(new Set(ids(SKILLS)).size).toBe(SKILLS.length);
    expect(new Set(ids(DECISIONS)).size).toBe(DECISIONS.length);
    expect(new Set(ids(TASKS)).size).toBe(TASKS.length);
  });
});

describe('抉择表', () => {
  it('每件事至少两个选项；持续的修正都写了天数', () => {
    for (const decision of DECISIONS) {
      expect(decision.options.length, decision.id).toBeGreaterThanOrEqual(2);
      for (const option of decision.options) {
        if (option.modifiers) expect(option.days, `${decision.id}.${option.id}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('病原体档案', () => {
  it('以真实疾病为原型的档案都列了出处，百科里至少有三条事实', () => {
    for (const pathogen of PATHOGENS) {
      if (pathogen.id === 'novel') continue;
      expect(SOURCES[pathogen.id]?.length, pathogen.id).toBeGreaterThan(0);
      for (const text of Object.values(CONTENT_TEXT)) {
        expect(text.pathogens[pathogen.id]?.facts.length, pathogen.id).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('两种语言的事实条数一样（一条对一条翻译）', () => {
    for (const pathogen of PATHOGENS) {
      expect(CONTENT_TEXT.en.pathogens[pathogen.id]?.facts.length, pathogen.id).toBe(
        CONTENT_TEXT.zh.pathogens[pathogen.id]?.facts.length,
      );
    }
  });
});

describe('章节', () => {
  it('五章都在，按诗的顺序；用到的病原体档案都有', () => {
    expect(CHAPTERS.map((chapter) => chapter.id)).toEqual([...CHAPTER_IDS]);
    const pathogens = new Set(ids(PATHOGENS));
    for (const chapter of CHAPTERS) {
      expect(pathogens.has(chapter.pathogen), chapter.id).toBe(true);
      expect(chapter.days).toBeGreaterThan(0);
    }
  });
});
