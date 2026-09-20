import Image from "next/image";
import { cn } from "cn";

export interface KigLogoProps {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
}

export function KigLogo({
  width = 200,
  height,
  className,
  priority = false,
  alt = "KIG Holding",
}: KigLogoProps) {
  // Natural aspect ratio: 1478 / 1064 = ~1.389 (approx 1.39:1)
  const computedHeight = height ?? Math.round(width / 1.39);

  return (
    <span className="inline-flex shrink-0 items-center justify-center">
      {/* Light theme logo: displayed in light mode, hidden in dark mode */}
      <Image
        src="/images/kig-no-bg-black.png"
        alt={alt}
        width={width}
        height={computedHeight}
        priority={priority}
        className={cn("h-auto object-contain dark:hidden", className)}
      />
      {/* Dark theme logo: hidden in light mode, displayed in dark mode */}
      <Image
        src="/images/kig-no-bg-white.png"
        alt=""
        aria-hidden="true"
        width={width}
        height={computedHeight}
        priority={priority}
        className={cn("hidden h-auto object-contain dark:block", className)}
      />
    </span>
  );
}
