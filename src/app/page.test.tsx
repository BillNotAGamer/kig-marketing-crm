import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import HomePage from "@/app/page";
import LoginPage from "@/app/login/page";
import { getCurrentSession } from "@/lib/auth/session";
import type { Actor } from "@/lib/auth/session-core";

vi.mock("server-only", () => ({}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

const mockActor: Actor = {
  id: "mock-user-id",
  name: "Admin User",
  email: "admin@kigholding.vn",
  role: "HEAD",
};

describe("application entry and login routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET / (HomePage)", () => {
    it("redirects unauthenticated visitor to /login", async () => {
      vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

      await expect(HomePage()).rejects.toThrow("REDIRECT:/login");
      expect(redirectMock).toHaveBeenCalledWith("/login");
    });

    it("redirects authenticated user to /dashboard", async () => {
      vi.mocked(getCurrentSession).mockResolvedValueOnce(mockActor);

      await expect(HomePage()).rejects.toThrow("REDIRECT:/dashboard");
      expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("GET /login (LoginPage)", () => {
    it("redirects already authenticated user to /dashboard", async () => {
      vi.mocked(getCurrentSession).mockResolvedValueOnce(mockActor);

      await expect(LoginPage()).rejects.toThrow("REDIRECT:/dashboard");
      expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    });

    it("renders the login page for unauthenticated visitor", async () => {
      vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

      const ui = await LoginPage();
      render(ui);

      expect(
        screen.getByRole("heading", { name: "KIG Marketing CRM" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Hệ thống quản lý công việc Marketing"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("img", { name: "KIG Holding" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Chào mừng bạn quay lại")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Đăng nhập" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Tài khoản và mật khẩu được quản lý bởi Trưởng bộ phận.",
        ),
      ).toBeInTheDocument();
      expect(redirectMock).not.toHaveBeenCalled();
    });
  });
});
