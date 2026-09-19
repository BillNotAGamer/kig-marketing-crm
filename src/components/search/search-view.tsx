"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Filter, Search as SearchIcon, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TaskSearchResultDto } from "@/lib/search/model";

interface SearchViewProps {
  initialData: TaskSearchResultDto;
  isTeamReader: boolean;
}

export function SearchView({ initialData, isTeamReader }: SearchViewProps) {
  const router = useRouter();
  const { items, total, page, totalPages, query } = initialData;

  const [q, setQ] = useState(query.q || "");
  const [status, setStatus] = useState(query.status || "");
  const [priority, setPriority] = useState(query.priority || "");
  const [fromAssigned, setFromAssigned] = useState(query.fromAssigned || "");
  const [toAssigned, setToAssigned] = useState(query.toAssigned || "");
  const [showFilters, setShowFilters] = useState(
    Boolean(status || priority || fromAssigned || toAssigned),
  );

  function executeSearch(newPage = 1) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (fromAssigned) params.set("fromAssigned", fromAssigned);
    if (toAssigned) params.set("toAssigned", toAssigned);
    if (newPage > 1) params.set("page", String(newPage));

    router.push(`/search?${params.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    executeSearch(1);
  }

  function clearFilters() {
    setStatus("");
    setPriority("");
    setFromAssigned("");
    setToAssigned("");
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`/search?${params.toString()}`);
  }

  const priorityBadgeStyle: Record<string, string> = {
    LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    NORMAL: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    URGENT: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  };

  const priorityLabel: Record<string, string> = {
    LOW: "Thấp",
    NORMAL: "Bình thường",
    HIGH: "Cao",
    URGENT: "Khẩn cấp",
  };

  const statusLabel: Record<string, string> = {
    OPEN: "Đang thực hiện",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
  };

  return (
    <div className="space-y-6">
      {/* Search Input Box */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={
                  isTeamReader
                    ? "Tìm theo tiêu đề, mô tả hoặc người được giao..."
                    : "Tìm theo tiêu đề hoặc mô tả công việc..."
                }
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 h-11 text-sm"
              />
            </div>
            <Button type="submit" className="min-h-11 px-5">
              Tìm kiếm
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-1.5 h-4 w-4" />
              Bộ lọc
            </Button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="border-t pt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="search-status"
                  className="text-xs text-muted-foreground"
                >
                  Trạng thái
                </Label>
                <select
                  id="search-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="OPEN">Đang thực hiện</option>
                  <option value="COMPLETED">Hoàn thành</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="search-priority"
                  className="text-xs text-muted-foreground"
                >
                  Mức độ ưu tiên
                </Label>
                <select
                  id="search-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">Tất cả độ ưu tiên</option>
                  <option value="URGENT">Khẩn cấp</option>
                  <option value="HIGH">Cao</option>
                  <option value="NORMAL">Bình thường</option>
                  <option value="LOW">Thấp</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="search-from-assigned"
                  className="text-xs text-muted-foreground"
                >
                  Giao từ ngày
                </Label>
                <Input
                  id="search-from-assigned"
                  type="date"
                  value={fromAssigned}
                  onChange={(e) => setFromAssigned(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="search-to-assigned"
                  className="text-xs text-muted-foreground"
                >
                  Giao đến ngày
                </Label>
                <Input
                  id="search-to-assigned"
                  type="date"
                  value={toAssigned}
                  onChange={(e) => setToAssigned(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground"
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Xóa bộ lọc
                </Button>
                <Button type="submit" size="sm" className="h-8 text-xs">
                  Áp dụng bộ lọc
                </Button>
              </div>
            </div>
          )}
        </form>
      </Card>

      {/* Results Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Tìm thấy {total} công việc</span>
          {totalPages > 1 && (
            <span>
              Trang {page} / {totalPages}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <SearchIcon className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-base font-medium">
              Không tìm thấy công việc nào
            </p>
            <p className="text-xs mt-1">
              Thử tìm kiếm với từ khóa khác hoặc điều chỉnh lại bộ lọc.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((t) => (
              <Card
                key={t.id}
                className="p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-[240px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          priorityBadgeStyle[t.priority]
                        }`}
                      >
                        {priorityLabel[t.priority]}
                      </span>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                        {statusLabel[t.status]}
                      </span>
                      {t.isOverdue && (
                        <span className="flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          Quá hạn
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-semibold leading-snug">
                      <Link
                        href={`/tasks/${t.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {t.title}
                      </Link>
                    </h3>

                    {t.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {t.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                    >
                      <Link href={`/tasks/${t.id}`}>Xem chi tiết</Link>
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2.5 text-xs text-muted-foreground">
                  {isTeamReader && (
                    <span>
                      Người được giao:{" "}
                      <strong className="font-medium text-foreground">
                        {t.assignedToName}
                      </strong>
                    </span>
                  )}
                  <span>Giao: {t.assignedDate}</span>
                  {t.dueDate && <span>Hạn: {t.dueDate}</span>}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => executeSearch(page - 1)}
            >
              Trang trước
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => executeSearch(page + 1)}
            >
              Trang sau
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
