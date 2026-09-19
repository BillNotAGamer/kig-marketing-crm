"use client";

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  ListTodo,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DashboardDto } from "@/lib/dashboard/model";

interface DashboardViewProps {
  data: DashboardDto;
}

export function DashboardView({ data }: DashboardViewProps) {
  const { summary, employeeBreakdown, overdueTasks, isTeamView } = data;

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

  return (
    <div className="space-y-8">
      {/* Top summary cards */}
      <section aria-labelledby="dashboard-summary-heading">
        <h2 id="dashboard-summary-heading" className="sr-only">
          Tóm tắt hoạt động hôm nay
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Card className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Tổng việc
              </span>
              <ListTodo className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold">{summary.total}</div>
            <p className="mt-1 text-xs text-muted-foreground">Hôm nay</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Đã xong
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary.completed}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Báo cáo hoàn thành
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Chưa xong
              </span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary.notCompleted}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Có lý do chưa xong
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Chưa báo
              </span>
              <HelpCircle className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-600 dark:text-slate-400">
              {summary.notReported}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Chưa có cập nhật
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Tiến độ
              </span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-primary">
              {summary.completionRate}%
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${summary.completionRate}%` }}
              />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Quá hạn
              </span>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
            <div className="mt-2 text-2xl font-bold text-destructive">
              {summary.overdueCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Cần xử lý ngay</p>
          </Card>
        </div>
      </section>

      {/* Team Breakdown Table (HEAD & DEPUTY) */}
      {isTeamView && (
        <section aria-labelledby="team-breakdown-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="team-breakdown-heading" className="text-lg font-semibold">
              Chi tiết công việc theo nhân viên
            </h2>
            <span className="text-xs text-muted-foreground">
              {employeeBreakdown.length} thành viên
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nhân viên</th>
                  <th className="px-3 py-3 text-center">Tổng việc</th>
                  <th className="px-3 py-3 text-center text-emerald-600">
                    Đã xong
                  </th>
                  <th className="px-3 py-3 text-center text-amber-600">
                    Chưa xong
                  </th>
                  <th className="px-3 py-3 text-center text-slate-500">
                    Chưa báo
                  </th>
                  <th className="px-3 py-3 text-center">Tỷ lệ</th>
                  <th className="px-4 py-3 text-center text-destructive">
                    Quá hạn
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employeeBreakdown.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Không có dữ liệu nhân viên.
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
                          {emp.role} · {emp.email}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center font-semibold">
                        {emp.total}
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">
                        {emp.completed}
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-amber-600 dark:text-amber-400">
                        {emp.notCompleted}
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-slate-500">
                        {emp.notReported}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                          {emp.completionRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-destructive">
                        {emp.overdueCount > 0 ? emp.overdueCount : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Overdue Tasks Section */}
      <section aria-labelledby="overdue-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            id="overdue-heading"
            className="flex items-center gap-2 text-lg font-semibold text-destructive"
          >
            <AlertCircle className="h-5 w-5" />
            Công việc đang quá hạn ({overdueTasks.length})
          </h2>
        </div>

        {overdueTasks.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            Tuyệt vời! Không có công việc nào đang quá hạn.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overdueTasks.map((t) => (
              <Card
                key={t.id}
                className="flex flex-col justify-between border-destructive/20 p-4 hover:border-destructive/40"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        priorityBadgeStyle[t.priority]
                      }`}
                    >
                      {priorityLabel[t.priority]}
                    </span>
                    <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      Hạn: {t.dueDate}
                    </span>
                  </div>

                  <h3 className="mt-2 text-base font-semibold line-clamp-2">
                    {t.title}
                  </h3>

                  {isTeamView && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Giao cho:{" "}
                      <span className="font-medium text-foreground">
                        {t.assignedToName}
                      </span>
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    Giao ngày: {t.assignedDate}
                  </span>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                  >
                    <Link href={`/tasks/${t.id}`}>Xem chi tiết</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
