export const taskStatusDisplay: Record<string, string> = {
  OPEN: "Đang mở",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

export const taskPriorityDisplay: Record<string, string> = {
  LOW: "Thấp",
  NORMAL: "Bình thường",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

export const roleDisplay: Record<string, string> = {
  HEAD: "Trưởng bộ phận",
  DEPUTY: "Phó bộ phận",
  EMPLOYEE: "Nhân viên",
};

export const roleSelectDisplay: Record<string, string> = {
  HEAD: "Trưởng bộ phận (HEAD)",
  DEPUTY: "Phó bộ phận (DEPUTY)",
  EMPLOYEE: "Nhân viên (EMPLOYEE)",
};

export function formatDisplayDate(
  val: string | Date | null | undefined,
): string {
  if (!val) return "";
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split("-");
    return `${d}/${m}/${y}`;
  }
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return String(val);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
