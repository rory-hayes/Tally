import React from "react";
import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "test-pk";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon";

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

if (typeof window !== "undefined") {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  const computedStyleStub = (() => ({
    getPropertyValue: () => "",
    display: "block",
  })) as typeof window.getComputedStyle;
  window.getComputedStyle = computedStyleStub;
  // Ensure document.defaultView (used by testing-library) shares the stub.
  if (window.document?.defaultView) {
    window.document.defaultView.getComputedStyle = computedStyleStub;
  }
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

