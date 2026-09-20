export const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type Priority = (typeof priorities)[number];
export type AssigneeOption = {
  id: string;
  name: string;
  role: "ADMIN" | "HEAD" | "DEPUTY" | "EMPLOYEE";
};
export type TaskDTO = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  assignedDate: string;
  dueDate: string | null;
  brandId: string | null;
  brandName: string | null;
  createdById: string;
  assignedToId: string;
  creator: { id: string; name: string };
  assignee: { id: string; name: string };
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};
