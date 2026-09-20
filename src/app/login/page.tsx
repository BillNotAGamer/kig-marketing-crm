import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeControls } from "@/components/theme-controls";
import { KigLogo } from "@/components/ui/kig-logo";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default async function LoginPage() {
  if (await getCurrentSession()) redirect("/dashboard");
  return (
    <main className="flex min-h-svh items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <KigLogo
            width={220}
            height={158}
            priority
            className="w-[190px] sm:w-[220px]"
          />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            KIG Marketing CRM
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Hệ thống quản lý công việc Marketing
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Chào mừng bạn quay lại</CardTitle>
            <CardDescription>
              Đăng nhập để truy cập hệ thống nội bộ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
        <ThemeControls />
      </div>
    </main>
  );
}
