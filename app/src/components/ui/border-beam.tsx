"use client";

import { cn } from "@/lib/utils";
import React from "react";

interface BorderBeamProps {
  children: React.ReactNode;
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  anchor?: number;
  colorFrom?: string;
  colorTo?: string;
}

const BorderBeam: React.FC<BorderBeamProps> = ({
  children,
  className,
  size = 200,
  duration = 15,
  anchor = 90,
  borderWidth = 1.5,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
}) => {
  return (
    <div
      style={
        {
          "--size": size,
          "--duration": duration + "s",
          "--anchor": anchor + "%",
          "--border-width": borderWidth + "px",
          "--color-from": colorFrom,
          "--color-to": colorTo,
        } as React.CSSProperties
      }
      className={cn(
        "relative rounded-lg bg-background",
        "before:absolute before:inset-0 before:rounded-lg before:p-[--border-width]",
        "before:bg-[conic-gradient(from_calc(270deg-(var(--anchor)*1deg)),transparent_0%,var(--color-from)_var(--anchor),var(--color-to)_calc(var(--anchor)*2%),transparent_calc(var(--anchor)*2%))]",
        "before:animate-[border-beam_var(--duration)_linear_infinite]",
        "before:[background-size:calc(var(--size)*1px)_calc(var(--size)*1px)]",
        "before:[mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]",
        "before:[mask-composite:subtract]",
        className,
      )}
    >
      {children}
    </div>
  );
};

export default BorderBeam;