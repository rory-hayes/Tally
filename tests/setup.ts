import React from "react";
import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

type ImageProps = {
  src?: string | { src: string };
  alt?: string;
  priority?: boolean;
} & Record<string, unknown>;

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, priority: _priority, ...rest }: ImageProps) =>
    React.createElement("img", {
      ...rest,
      src: typeof src === "string" ? src : src?.src ?? "",
      alt: alt ?? "",
    }),
}));

if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

