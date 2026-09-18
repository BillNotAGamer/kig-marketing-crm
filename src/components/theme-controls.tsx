"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeControls() {
  const { setTheme } = useTheme();
  return (
    <div role="group" aria-label="Appearance" className="flex flex-wrap gap-2">
      {(["light", "dark", "system"] as const).map((theme) => (
        <Button
          key={theme}
          variant="outline"
          className="min-h-11 min-w-20"
          onClick={() => setTheme(theme)}
        >
          {theme.charAt(0).toUpperCase() + theme.slice(1)}
        </Button>
      ))}
    </div>
  );
}
