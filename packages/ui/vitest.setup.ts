import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom lacks these browser APIs that Radix relies on.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: ResizeObserverStub,
    configurable: true,
  });
}
const elementStubs = {
  scrollIntoView: (): void => {},
  hasPointerCapture: (): boolean => false,
  releasePointerCapture: (): void => {},
};
for (const [name, value] of Object.entries(elementStubs)) {
  if (!(name in Element.prototype))
    Object.defineProperty(Element.prototype, name, { value, configurable: true });
}
