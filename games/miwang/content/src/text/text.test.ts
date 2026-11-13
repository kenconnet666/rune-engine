import { describe, expect, it } from 'vitest';
import { EVENTS } from '../tables/events.ts';
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
