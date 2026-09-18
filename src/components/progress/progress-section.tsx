import type { ProgressView } from "@/lib/progress/model";
import { ProgressActions } from "./progress-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProgressSection({
  taskId,
  view,
}: {
  taskId: string;
  view: ProgressView;
}) {
  return (
    <Card aria-label="Daily Progress">
      <CardHeader>
        <CardTitle>Daily Progress</CardTitle>
        <p className="text-sm text-muted-foreground">
          Today: {view.today.reportDate} · {view.today.status}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {view.today.report && (
          <p className="text-sm font-medium">Đã cập nhật hôm nay</p>
        )}
        {view.canSubmit && <ProgressActions taskId={taskId} />}
        {view.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No progress history yet.
          </p>
        ) : (
          <ol aria-label="Progress history" className="space-y-4">
            {view.history.map((report) => (
              <li key={report.id} className="space-y-2 rounded-lg border p-4">
                <p className="text-sm font-semibold">
                  {report.reportDate} · {report.status}
                </p>
                {report.reason && (
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {report.reason}
                  </p>
                )}
                {report.isCorrected && (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      Administratively corrected ·{" "}
                      {new Intl.DateTimeFormat("en-GB", {
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
            <h2 className="text-sm font-semibold">HEAD administration</h2>
            <p className="text-sm text-muted-foreground">
              Only the latest report may change status. Historical dates and
              reporting ownership remain unchanged.
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
