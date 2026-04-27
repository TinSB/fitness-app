import { expect } from 'vitest';

export const expectCleanExplanation = (text: string) => {
  expect(text).toBeTruthy();
  expect(text.trim()).toBe(text);
  expect(text).not.toMatch(/\b(undefined|null)\b/);
  expect(text).not.toMatch(/\b(add_new_exercise|reduce_support|increase_support|review_manually|too_early|rollback|high|medium|low)\b/);
};

export const expectCleanExplanationList = (items: string[]) => {
  expect(items.length).toBeGreaterThan(0);
  items.forEach(expectCleanExplanation);
};
