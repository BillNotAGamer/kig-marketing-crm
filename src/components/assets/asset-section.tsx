"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TaskAssetDTO, TaskAssetView } from "@/lib/assets/model";

export function AssetSection({
  taskId,
  view,
}: {
  taskId: string;
  view: TaskAssetView;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<TaskAssetDTO | null>(null);
  const [removeAsset, setRemoveAsset] = useState<TaskAssetDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sourceUrl = form.get("sourceUrl") as string;
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/tasks/${taskId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl }),
      });

      if (!response.ok) {
        const body: { error?: string } = await response.json();
        setError(body.error ?? "Không thể đính kèm sản phẩm.");
        return;
      }

      setAddOpen(false);
      router.refresh();
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!removeAsset) return;
    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        `/api/tasks/${taskId}/assets/${removeAsset.id}/remove`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        const body: { error?: string } = await response.json();
        setError(body.error ?? "Không thể gỡ bỏ sản phẩm.");
        return;
      }

      setRemoveAsset(null);
      router.refresh();
    } catch {
      setError("Không thể gỡ bỏ sản phẩm. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card aria-label="Sản phẩm / Deliverables">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Sản phẩm / Deliverables</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tài liệu và sản phẩm bàn giao từ Google Drive.
          </p>
        </div>
        {view.canAdd && (
          <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              if (!busy) {
                setAddOpen(open);
                setError("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="min-h-11">+ Thêm sản phẩm</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Thêm sản phẩm từ Google Drive</DialogTitle>
                <DialogDescription>
                  Dán đường dẫn tệp Google Drive hoặc Google Docs, Sheets,
                  Slides. Hệ thống sẽ tự động trích xuất thông tin.
                </DialogDescription>
              </DialogHeader>
              <form
                aria-label="Thêm sản phẩm"
                onSubmit={handleAdd}
                className="space-y-4 pt-2"
              >
                <div className="space-y-2">
                  <Label htmlFor="source-url">Google Drive URL</Label>
                  <Input
                    id="source-url"
                    name="sourceUrl"
                    type="url"
                    required
                    placeholder="https://drive.google.com/file/d/... hoặc docs.google.com/..."
                    disabled={busy}
                    className="min-h-11"
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={busy}
                  className="min-h-11 w-full"
                >
                  {busy ? "Đang lưu…" : "Lưu sản phẩm"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {view.assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có sản phẩm nào được đính kèm.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
            {view.assets.map((asset) => (
              <div
                key={asset.id}
                className="flex flex-col justify-between space-y-3 rounded-lg border p-4 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {asset.assetType}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Google Drive
                    </span>
                  </div>
                  <p
                    className="line-clamp-2 font-medium break-words text-sm"
                    title={asset.fileName ?? "Tệp không có tên"}
                  >
                    {asset.fileName ?? "Tệp Google Drive"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Đính kèm bởi {asset.createdByName} ·{" "}
                    {new Intl.DateTimeFormat("vi-VN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Ho_Chi_Minh",
                    }).format(new Date(asset.createdAt))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-9 text-xs"
                    onClick={() => setPreviewAsset(asset)}
                  >
                    Xem trước
                  </Button>
                  <a
                    href={asset.openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    Mở trên Google Drive ↗
                  </a>
                  {asset.canRemove && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-9 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setRemoveAsset(asset)}
                    >
                      Gỡ bỏ
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview Viewer Dialog */}
        <Dialog
          open={previewAsset !== null}
          onOpenChange={(open) => {
            if (!open) setPreviewAsset(null);
          }}
        >
          <DialogContent className="max-h-[95dvh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="truncate">
                {previewAsset?.fileName ?? "Bản xem trước"}
              </DialogTitle>
              <DialogDescription>
                Bản xem trước trực tiếp từ Google Drive.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                {previewAsset && (
                  <iframe
                    src={previewAsset.previewUrl}
                    title={previewAsset.fileName ?? "Google Drive Preview"}
                    className="h-full w-full border-0"
                    allow="autoplay"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
                <p>
                  Nếu bản xem trước không tải được, bạn có thể cần quyền truy
                  cập Google Drive.
                </p>
                {previewAsset && (
                  <a
                    href={previewAsset.openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center font-medium text-foreground underline hover:text-primary"
                  >
                    Mở trên Google Drive ↗
                  </a>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewAsset(null)}
              >
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Removal Confirmation Dialog */}
        <Dialog
          open={removeAsset !== null}
          onOpenChange={(open) => {
            if (!busy && !open) {
              setRemoveAsset(null);
              setError("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xác nhận gỡ bỏ sản phẩm</DialogTitle>
              <DialogDescription>
                Bạn có chắc chắn muốn gỡ bỏ liên kết đến sản phẩm này? Tệp gốc
                trên Google Drive sẽ không bị xóa hoặc thay đổi.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setRemoveAsset(null)}
                className="min-h-11"
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={handleRemove}
                className="min-h-11"
              >
                {busy ? "Đang gỡ…" : "Xác nhận gỡ bỏ"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
