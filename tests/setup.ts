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

