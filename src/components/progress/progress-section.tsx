import type { ProgressView } from "@/lib/progress/model";
import { ProgressActions } from "./progress-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDisplayDate } from "@/lib/ui-labels";

const progressStatusDisplay: Record<string, string> = {
  COMPLETED: "Hoàn thành",
  NOT_COMPLETED: "Chưa hoàn thành",
  NOT_REPORTED: "Chưa báo cáo",
};

export function ProgressSection({
  taskId,
  view,
}: {
  taskId: string;
  view: ProgressView;
}) {
  return (
    <Card aria-label="Tiến độ hàng ngày">
      <CardHeader>
        <CardTitle>Tiến độ hàng ngày</CardTitle>
        <p className="text-sm text-muted-foreground">
          Hôm nay: {formatDisplayDate(view.today.reportDate)} ·{" "}
          {progressStatusDisplay[view.today.status] ?? view.today.status}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {view.today.report && (
          <p className="text-sm font-medium">Đã cập nhật hôm nay</p>
        )}
        {view.canSubmit && <ProgressActions taskId={taskId} />}
        {view.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có lịch sử tiến độ nào.
          </p>
        ) : (
          <ol aria-label="Lịch sử tiến độ" className="space-y-4">
            {view.history.map((report) => (
              <li key={report.id} className="space-y-2 rounded-lg border p-4">
                <p className="text-sm font-semibold">
                  {formatDisplayDate(report.reportDate)} ·{" "}
                  {progressStatusDisplay[report.status] ?? report.status}
                </p>
                {report.reason && (
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {report.reason}
                  </p>
                )}
                {report.isCorrected && (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      Điều chỉnh bởi quản trị ·{" "}
                      {new Intl.DateTimeFormat("vi-VN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Ho_Chi_Minh",
                      }).format(new Date(report.correctedAt!))}
                    </p>
                    <p className="whitespace-pre-wrap break-words">
                      {report.correctionReason}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {view.canCorrect && (
          <div className="space-y-3 border-t pt-5">
            <h2 className="text-sm font-semibold">Quản trị tiến độ (HEAD)</h2>
            <p className="text-sm text-muted-foreground">
              Chỉ báo cáo mới nhất mới có thể thay đổi trạng thái. Ngày báo cáo
              và quyền sở hữu ban đầu được giữ nguyên.
            </p>
            <ProgressActions
              key={`${view.history[0].id}:${view.history[0].status}:${view.history[0].correctedAt ?? "original"}`}
              taskId={taskId}
              latest={view.history[0]}
              correction
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
