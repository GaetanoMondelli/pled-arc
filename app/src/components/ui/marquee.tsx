"use client";

import { cn } from "@/lib/utils";
import React from "react";

interface MarqueeProps {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children?: React.ReactNode;
  vertical?: boolean;
  repeat?: number;
  speed?: "slow" | "normal" | "fast";
}

const Marquee: React.FC<MarqueeProps> = ({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  speed = "normal",
}) => {
  const speedClass = {
    slow: "animate-marquee-slow",
    normal: "animate-marquee",
    fast: "animate-marquee-fast",
  };

  return (
    <div
      className={cn(
        "group flex overflow-hidden p-2 [--duration:40s] [--gap:1rem] [gap:var(--gap)]",
        {
          "flex-row": !vertical,
          "flex-col": vertical,
        },
        className,
      )}
    >
      {Array(repeat)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex shrink-0 justify-around [gap:var(--gap)]",
              {
                "animate-marquee [--duration:20s]": !reverse && speed === "normal",
                "animate-marquee-reverse [--duration:20s]": reverse && speed === "normal",
                "animate-marquee [--duration:30s]": !reverse && speed === "slow",
                "animate-marquee-reverse [--duration:30s]": reverse && speed === "slow",
                "animate-marquee [--duration:10s]": !reverse && speed === "fast",
                "animate-marquee-reverse [--duration:10s]": reverse && speed === "fast",
                "flex-row": !vertical,
                "flex-col": vertical,
                "group-hover:[animation-play-state:paused]": pauseOnHover,
              },
            )}
          >
            {children}
          </div>
        ))}
    </div>
  );
};

export default Marquee;