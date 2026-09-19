import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("untrusted business text rendering", () => {
  it.each([
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    '\"><svg/onload=alert(1)>',
  ])("renders attack-like text inertly", (value) => {
    const { container } = render(<p>{value}</p>);
    expect(screen.getByText(value)).toBeInTheDocument();
    expect(container.querySelector("script,img,svg")).toBeNull();
  });
});
