import { describe, expect, it } from 'vitest';
import { EVENTS } from '../tables/events.ts';
import { PATHOGENS, SOURCES } from '../tables/pathogens.ts';
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
      expect(Object.keys(text.pathogens).sort()).toEqual(ids(PATHOGENS));
      for (const group of [text.traits, text.techs, text.events, text.measures]) {
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
