import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";
import { ThemeProvider } from "@/components/theme-provider";

describe("project foundation", () => {
  it("renders the project identity and three appearance choices", () => {
    render(
      <ThemeProvider attribute="class" enableSystem={false}>
        <Home />
      </ThemeProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "KIG Marketing CRM" }),
    ).toBeInTheDocument();
    for (const name of ["Light", "Dark", "System"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });
});
