"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Filter,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDays } from "@/lib/calendar/date";
import type { ReportsDto } from "@/lib/reports/model";
import { roleDisplay } from "@/lib/ui-labels";

interface ReportsViewProps {
  data: ReportsDto;
}

export function ReportsView({ data }: ReportsViewProps) {
  const router = useRouter();
  const { from, to, summary, employeeBreakdown, isTeamView, businessToday } =
    data;

  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);

  function applyFilter(f: string, t: string) {
    const params = new URLSearchParams();
    params.set("from", f);
    params.set("to", t);
    router.push(`/reports?${params.toString()}`);
  }

  function handlePreset(days: number) {
    const newFrom = addDays(businessToday, -(days - 1));
    const newTo = businessToday;
    setFromInput(newFrom);
    setToInput(newTo);
    applyFilter(newFrom, newTo);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fromInput && toInput) {
      applyFilter(fromInput, toInput);
    }
  }

  return (
    <div className="space-y-8">
      {/* Date Range Filter Bar */}
      <Card className="p-4">
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-4"
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="report-from"
              className="text-xs text-muted-foreground"
            >
              Từ ngày
            </Label>
            <Input
              id="report-from"
              type="date"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              className="h-9 w-40 text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="report-to"
              className="text-xs text-muted-foreground"
            >
              Đến ngày
            </Label>
            <Input
              id="report-to"
              type="date"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              className="h-9 w-40 text-sm"
              required
            />
          </div>

          <Button type="submit" size="sm" className="h-9">
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            Lọc báo cáo
          </Button>

          <div className="flex items-center gap-1.5 pt-1 sm:ml-auto">
            <span className="text-xs text-muted-foreground mr-1">Nhanh:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => handlePreset(7)}
            >
              7 ngày
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => handlePreset(30)}
            >
              30 ngày
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => handlePreset(90)}
            >
              90 ngày
            </Button>
          </div>
        </form>
      </Card>

      {/* Report Summary Cards */}
      <section aria-labelledby="report-summary-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="report-summary-heading" className="text-lg font-semibold">
            Dữ liệu hoạt động thực tế ({from} đến {to})
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Card className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Báo cáo nộp
              </span>
              <FileSpreadsheet className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold">
              {summary.submittedReportsCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Tổng bản ghi đã nộp
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Báo cáo xong
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary.completedReportsCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Hoàn thành</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Chưa xong
              </span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary.notCompletedReportsCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Có lý do tồn đọng
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Tỷ lệ đạt
              </span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-primary">
              {summary.completionRatioSubmitted}%
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Trong báo cáo đã nộp
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Giao trong kỳ
              </span>
              <Calendar className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-2 text-2xl font-bold">
              {summary.tasksAssignedInRange}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Công việc được giao
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Quá hạn hiện tại
              </span>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
            <div className="mt-2 text-2xl font-bold text-destructive">
              {summary.currentOverdueCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Trạng thái hiện tại
            </p>
          </Card>
        </div>
      </section>

      {/* Per Employee Breakdown Table (HEAD / DEPUTY) */}
      {isTeamView && (
        <section
          aria-labelledby="reports-employee-heading"
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 id="reports-employee-heading" className="text-lg font-semibold">
              Thống kê báo cáo theo nhân viên
            </h2>
            <span className="text-xs text-muted-foreground">
              {employeeBreakdown.length} người dùng
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Người báo cáo</th>
                  <th className="px-3 py-3 text-center">Báo cáo đã nộp</th>
                  <th className="px-3 py-3 text-center text-emerald-600">
                    Hoàn thành
                  </th>
                  <th className="px-3 py-3 text-center text-amber-600">
                    Chưa hoàn thành
                  </th>
                  <th className="px-3 py-3 text-center">Tỷ lệ hoàn thành</th>
                  <th className="px-4 py-3 text-center text-destructive">
                    Quá hạn (hiện tại)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employeeBreakdown.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Không có báo cáo nào trong khoảng thời gian này.
                    </td>
                  </tr>
                ) : (
                  employeeBreakdown.map((emp) => (
                    <tr key={emp.userId} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {emp.name}
                          {emp.banned && (
                            <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                              Vô hiệu hóa
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {roleDisplay[emp.role] ?? emp.role} · {emp.email}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center font-semibold">
                        {emp.submittedReportsCount}
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">
                        {emp.completedReportsCount}
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-amber-600 dark:text-amber-400">
                        {emp.notCompletedReportsCount}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                          {emp.completionRatioSubmitted}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-destructive">
                        {emp.currentOverdueCount > 0
                          ? emp.currentOverdueCount
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
