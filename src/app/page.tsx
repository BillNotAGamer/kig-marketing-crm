import { ThemeControls } from "@/components/theme-controls";

export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg space-y-6">
        <p className="text-sm text-muted-foreground">KIG Holding</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          KIG Marketing CRM
        </h1>
        <p className="text-base text-muted-foreground">
          Development foundation · Phase 0
        </p>
        <ThemeControls />
      </div>
    </main>
  );
}
