"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  priorities,
  type AssigneeOption,
  type TaskDTO,
} from "@/lib/tasks/types";
import type { BrandDTO } from "@/lib/brands/types";
import { roleDisplay, taskPriorityDisplay } from "@/lib/ui-labels";

export function TaskForm({
  options,
  brands = [],
  employee,
  assignedDate,
  task,
}: {
  options: AssigneeOption[];
  brands?: BrandDTO[];
  employee: boolean;
  assignedDate: string;
  task?: TaskDTO;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [brandList, setBrandList] = useState<BrandDTO[]>(brands);
  const [selectedBrandId, setSelectedBrandId] = useState<string>(
    task?.brandId ?? "",
  );
  const [isAddBrandOpen, setIsAddBrandOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandError, setBrandError] = useState("");

  async function handleAddBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const clean = newBrandName.trim();
    if (!clean) {
      setBrandError("Tên brand không được để trống.");
      return;
    }
    setBrandBusy(true);
    setBrandError("");
    try {
      const response = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean }),
      });
      const data = await response.json();
      if (!response.ok) {
        setBrandError(data.error || "Không thể tạo brand.");
        return;
      }
      const createdBrand: BrandDTO = data;
      setBrandList((prev) => {
        const next = [...prev, createdBrand];
        return next.sort((a, b) => a.name.localeCompare(b.name, "vi"));
      });
      setSelectedBrandId(createdBrand.id);
      setIsAddBrandOpen(false);
      setNewBrandName("");
    } catch {
      setBrandError("Không thể tạo brand. Vui lòng thử lại.");
    } finally {
      setBrandBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const body = {
      ...values,
      description: values.description || null,
      dueDate: values.dueDate || null,
    };
    try {
      const result = await fetch(
        task ? `/api/tasks/${task.id}/metadata` : "/api/tasks",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await result.json();
      if (!result.ok) {
        setError(data.error || "Không thể lưu công việc.");
        return;
      }
      router.replace(`/tasks/${task?.id ?? data.id}`);
      router.refresh();
    } catch {
      setError("Không thể lưu công việc. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }
  const control =
    "min-h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm";
  return (
    <>
      <form
        aria-label={task ? "Chỉnh sửa công việc" : "Tạo công việc"}
        onSubmit={submit}
        className="max-w-2xl space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="task-title">Tiêu đề</Label>
          <Input
            id="task-title"
            name="title"
            required
            maxLength={200}
            defaultValue={task?.title}
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-description">Mô tả</Label>
          <textarea
            id="task-description"
            name="description"
            maxLength={10_000}
            defaultValue={task?.description ?? ""}
            rows={4}
            className={`${control} py-3`}
          />
        </div>
        {!task && (
          <div className="space-y-2">
            <Label htmlFor="task-assignee">Người thực hiện</Label>
            {employee ? (
              <>
                <p className="text-sm">Bạn — {options[0]?.name}</p>
                <input
                  type="hidden"
                  name="assignedToId"
                  value={options[0]?.id ?? ""}
                />
              </>
            ) : (
              <select
                id="task-assignee"
                name="assignedToId"
                required
                className={control}
                defaultValue=""
              >
                <option value="" disabled>
                  Chọn nhân viên đang hoạt động
                </option>
                {options.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name} · {roleDisplay[value.role] ?? value.role}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="task-brand">Thương hiệu</Label>
            {!employee && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setBrandError("");
                  setNewBrandName("");
                  setIsAddBrandOpen(true);
                }}
                className="h-8 text-xs"
              >
                + Thêm brand
              </Button>
            )}
          </div>
          <select
            id="task-brand"
            name="brandId"
            required
            value={selectedBrandId}
            onChange={(e) => setSelectedBrandId(e.target.value)}
            className={control}
          >
            <option value="" disabled>
              Chọn thương hiệu
            </option>
            {brandList.map((value) => (
              <option key={value.id} value={value.id}>
                {value.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="assigned-date">Ngày giao việc</Label>
            <Input
              id="assigned-date"
              name="assignedDate"
              type="date"
              required
              defaultValue={task?.assignedDate ?? assignedDate}
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due-date">Hạn hoàn thành (không bắt buộc)</Label>
            <Input
              id="due-date"
              name="dueDate"
              type="date"
              defaultValue={task?.dueDate ?? ""}
              className="min-h-11"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-priority">Độ ưu tiên</Label>
          <select
            id="task-priority"
            name="priority"
            defaultValue={task?.priority ?? "NORMAL"}
            className={control}
          >
            {priorities.map((value) => (
              <option key={value} value={value}>
                {taskPriorityDisplay[value] ?? value}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-muted-foreground">
          Ngày được tính theo múi giờ Asia/Ho_Chi_Minh.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button disabled={busy} className="min-h-11 w-full sm:w-auto">
          {busy ? "Đang lưu…" : task ? "Lưu công việc" : "Tạo công việc"}
        </Button>
      </form>

      <Dialog open={isAddBrandOpen} onOpenChange={setIsAddBrandOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddBrand} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Thêm brand</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="new-brand-name">Tên brand</Label>
              <Input
                id="new-brand-name"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="Nhập tên brand"
                autoFocus
                disabled={brandBusy}
                maxLength={100}
              />
              {brandError && (
                <p role="alert" className="text-sm text-destructive">
                  {brandError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddBrandOpen(false);
                  setNewBrandName("");
                  setBrandError("");
                }}
                disabled={brandBusy}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={brandBusy || !newBrandName.trim()}
              >
                {brandBusy ? "Đang thêm…" : "Thêm brand"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
