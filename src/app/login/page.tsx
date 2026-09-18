import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeControls } from "@/components/theme-controls";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default async function LoginPage() {
  if (await getCurrentSession()) redirect("/app");
  return (
    <main className="flex min-h-svh items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">KIG Holding</p>
          <h1 className="mt-2 text-3xl font-semibold">KIG Marketing CRM</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Sign in to your internal workspace.
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
