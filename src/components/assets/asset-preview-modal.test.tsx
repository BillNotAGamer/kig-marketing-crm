import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssetSection } from "./asset-section";
import type { TaskAssetView, TaskAssetDTO } from "@/lib/assets/model";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockAsset: TaskAssetDTO = {
  id: "asset-1",
  taskId: "task-123",
  provider: "GOOGLE_DRIVE",
  providerFileId: "file-xyz",
  sourceUrl: "https://drive.google.com/file/d/file-xyz/view",
  fileName: "Marketing Strategy Document.pdf",
  mimeType: "application/pdf",
  assetType: "DOCUMENT",
  previewUrl: "https://docs.google.com/document/d/file-xyz/preview",
  openUrl: "https://docs.google.com/document/d/file-xyz/edit",
  createdAt: "2026-09-20T03:00:00.000Z",
  createdById: "user-1",
  createdByName: "KIG Marketing Admin",
  canRemove: false,
};

const mockView: TaskAssetView = {
  assets: [mockAsset],
  canAdd: false,
};

describe("AssetSection Preview Modal", () => {
  it("renders preview trigger button and opens enlarged preview modal", async () => {
    const user = userEvent.setup();
    render(<AssetSection taskId="task-123" view={mockView} />);

    const previewButton = screen.getByRole("button", {
      name: "Xem trước",
    });
    expect(previewButton).toBeInTheDocument();

    await user.click(previewButton);

    // Modal title exists
    const dialogTitle = screen.getByRole("heading", {
      name: "Marketing Strategy Document.pdf",
    });
    expect(dialogTitle).toBeInTheDocument();

    // Dialog content has enlarged dimensions
    const dialogContent = screen.getByRole("dialog");
    expect(dialogContent).toHaveClass("sm:max-w-[1200px]");
    expect(dialogContent).toHaveClass("sm:w-[94vw]");
    expect(dialogContent).toHaveClass("max-h-[92vh]");
    expect(dialogContent).toHaveClass("w-[calc(100vw-1rem)]");

    // Preview body container does not constrain with aspect-video and has ~70vh height
    const iframe = dialogContent.querySelector("iframe");
    expect(iframe).not.toBeNull();
    if (!iframe) throw new Error("iframe not found");
    expect(iframe).toHaveAttribute("src", mockAsset.previewUrl);

    const previewContainer = iframe.parentElement;
    expect(previewContainer).not.toBeNull();
    expect(previewContainer).not.toHaveClass("aspect-video");
    expect(previewContainer).toHaveClass("sm:h-[70vh]");
    expect(previewContainer).toHaveClass("overflow-x-hidden");

    // Footer elements
    expect(
      screen.getByText(
        /Nếu bản xem trước không tải được, bạn có thể cần quyền truy cập Google Drive./,
      ),
    ).toBeInTheDocument();

    const openLink = screen.getByRole("link", {
      name: "Mở trên Google Drive ↗",
    });
    expect(openLink).toHaveAttribute("href", mockAsset.openUrl);
    expect(openLink).toHaveAttribute("target", "_blank");

    // Close button dismisses dialog
    const closeBtn = screen.getByRole("button", { name: "Đóng" });
    await user.click(closeBtn);

    expect(
      screen.queryByRole("heading", {
        name: "Marketing Strategy Document.pdf",
      }),
    ).not.toBeInTheDocument();
  });
});
