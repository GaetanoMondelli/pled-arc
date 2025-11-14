"use client";

import { cn } from "@/lib/utils";
import React from "react";

interface ShineBorderProps {
  children: React.ReactNode;
  className?: string;
  size?: number;
  color?: string | string[];
  borderRadius?: number;
  borderWidth?: number;
  duration?: number;
}

const ShineBorder: React.FC<ShineBorderProps> = ({
  children,
  className,
  size = 10,
  color = "#ffffff",
  borderRadius = 8,
  borderWidth = 1,
  duration = 14,
}) => {
  return (
    <div
      style={
        {
          "--border-radius": `${borderRadius}px`,
        } as React.CSSProperties
      }
      className={cn(
        "relative grid min-h-[60px] w-fit min-w-[300px] place-items-center rounded-[--border-radius] bg-white p-3 text-black",
        className,
      )}
    >
      <div
        style={
          {
            "--border-width": `${borderWidth}px`,
            "--border-radius": `${borderRadius}px`,
            "--border-radius-child": `${borderRadius * 0.2}px`,
            "--shine-pulse-duration": `${duration}s`,
            "--mask-linear-gradient": `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
            "--background-radial-gradient": `radial-gradient(transparent,transparent, ${
              !(color instanceof Array) ? color : color.join(",")
            },transparent,transparent)`,
          } as React.CSSProperties
        }
        className={`before:bg-shine-size before:absolute before:inset-0 before:aspect-square before:size-full before:rounded-[--border-radius] before:p-[--border-width] before:will-change-[background-position] before:content-[""] before:![-webkit-mask-composite:subtract] before:[background-image:--background-radial-gradient] before:[background-size:300%_300%] before:[mask:--mask-linear-gradient] motion-safe:before:animate-shine`}
      />
      {children}
    </div>
  );
};

export default ShineBorder;