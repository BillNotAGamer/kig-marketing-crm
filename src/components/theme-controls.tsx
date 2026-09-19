"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "cn";

interface ThemeControlsProps {
  className?: string;
  showLabel?: boolean;
}

const themeOptions = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
  { value: "system", label: "Hệ thống", icon: Monitor },
] as const;

const emptySubscribe = () => () => {};

export function ThemeControls({
  className,
  showLabel = true,
}: ThemeControlsProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      {showLabel && (
        <span className="text-xs font-medium text-muted-foreground">
          Giao diện
        </span>
      )}
      <div
        role="group"
        aria-label="Giao diện"
        className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-1"
      >
        {themeOptions.map((opt) => {
          const Icon = opt.icon;
          const isSelected = mounted && theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              aria-pressed={isSelected}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                isSelected
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
