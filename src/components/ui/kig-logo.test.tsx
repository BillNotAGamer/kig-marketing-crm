import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KigLogo } from "./kig-logo";

describe("KigLogo Component", () => {
  it("renders both light and dark logo assets with correct CSS theme visibility", () => {
    const { container } = render(<KigLogo width={200} alt="KIG Holding" />);

    const images = container.querySelectorAll("img");
    expect(images.length).toBe(2);

    const lightImage = images[0];
    const darkImage = images[1];

    // Light asset verification
    expect(lightImage.getAttribute("src")).toContain("kig-no-bg-black.png");
    expect(lightImage.className).toContain("dark:hidden");
    expect(lightImage.getAttribute("alt")).toBe("KIG Holding");

    // Dark asset verification
    expect(darkImage.getAttribute("src")).toContain("kig-no-bg-white.png");
    expect(darkImage.className).toContain("hidden");
    expect(darkImage.className).toContain("dark:block");
    expect(darkImage.getAttribute("aria-hidden")).toBe("true");
  });

  it("applies custom width and custom className", () => {
    const { container } = render(
      <KigLogo width={150} height={108} className="custom-test-class" />,
    );

    const images = container.querySelectorAll("img");
    expect(images[0].className).toContain("custom-test-class");
    expect(images[0].getAttribute("width")).toBe("150");
    expect(images[0].getAttribute("height")).toBe("108");
  });

  it("exposes single accessible image with alt text for assistive tech", () => {
    render(<KigLogo alt="KIG Holding" />);

    // Screen readers should only find one accessible image
    const accessibleImages = screen.getAllByRole("img", {
      name: "KIG Holding",
    });
    expect(accessibleImages).toHaveLength(1);
  });
});
