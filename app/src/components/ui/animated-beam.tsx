"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import React, { forwardRef, useRef } from "react";

export interface AnimatedBeamProps {
  className?: string;
  containerRef: React.RefObject<HTMLElement>;
  fromRef: React.RefObject<HTMLElement>;
  toRef: React.RefObject<HTMLElement>;
  curvature?: number;
  reverse?: boolean;
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  delay?: number;
  duration?: number;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
}

export const AnimatedBeam = forwardRef<SVGSVGElement, AnimatedBeamProps>(
  (
    {
      className,
      containerRef,
      fromRef,
      toRef,
      curvature = 0,
      reverse = false,
      duration = Math.random() * 3 + 4,
      delay = 0,
      pathColor = "gray",
      pathWidth = 2,
      pathOpacity = 0.2,
      gradientStartColor = "#18CCFC",
      gradientStopColor = "#6344F5",
      startXOffset = 0,
      startYOffset = 0,
      endXOffset = 0,
      endYOffset = 0,
    },
    ref,
  ) => {
    const id = React.useId();
    const svgRef = useRef<SVGSVGElement>(null);
    const [pathD, setPathD] = React.useState("");
    const [svgDimensions, setSvgDimensions] = React.useState({ width: 0, height: 0 });

    const updatePath = React.useCallback(() => {
      if (containerRef.current && fromRef.current && toRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const fromRect = fromRef.current.getBoundingClientRect();
        const toRect = toRef.current.getBoundingClientRect();

        const relativeFrom = {
          x: fromRect.left - containerRect.left + fromRect.width / 2 + startXOffset,
          y: fromRect.top - containerRect.top + fromRect.height / 2 + startYOffset,
        };
        const relativeTo = {
          x: toRect.left - containerRect.left + toRect.width / 2 + endXOffset,
          y: toRect.top - containerRect.top + toRect.height / 2 + endYOffset,
        };

        const dx = relativeTo.x - relativeFrom.x;
        const dy = relativeTo.y - relativeFrom.y;

        const curvatureMultiplier = curvature * Math.sqrt(dx * dx + dy * dy);

        const midX = relativeFrom.x + dx / 2;
        const midY = relativeFrom.y + dy / 2;

        const controlX = midX + curvatureMultiplier;
        const controlY = midY + curvatureMultiplier;

        const d = `M ${relativeFrom.x},${relativeFrom.y} Q ${controlX},${controlY} ${relativeTo.x},${relativeTo.y}`;
        setPathD(d);

        setSvgDimensions({
          width: containerRect.width,
          height: containerRect.height,
        });
      }
    }, [
      containerRef,
      fromRef,
      toRef,
      curvature,
      startXOffset,
      startYOffset,
      endXOffset,
      endYOffset,
    ]);

    React.useEffect(() => {
      updatePath();

      const resizeObserver = new ResizeObserver(() => updatePath());
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }
      return () => resizeObserver.disconnect();
    }, [updatePath]);

    return (
      <svg
        ref={ref}
        width={svgDimensions.width}
        height={svgDimensions.height}
        className={cn(
          "pointer-events-none absolute left-0 top-0 transform-gpu stroke-2",
          className,
        )}
        viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
      >
        <defs>
          <linearGradient
            className={cn("transform-gpu")}
            id={id}
            gradientUnits="userSpaceOnUse"
            x1="0%"
            x2="100%"
            y1="0%"
            y2="0%"
          >
            <stop offset="0%" stopColor={gradientStartColor} stopOpacity="0" />
            <stop offset="50%" stopColor={gradientStartColor} />
            <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={pathD}
          stroke={pathColor}
          strokeWidth={pathWidth}
          strokeOpacity={pathOpacity}
          fill="none"
        />
        <motion.path
          d={pathD}
          stroke={`url(#${id})`}
          strokeWidth={pathWidth}
          fill="none"
          initial={{
            strokeDasharray: 1000,
            strokeDashoffset: reverse ? -1000 : 1000,
          }}
          animate={{
            strokeDasharray: 1000,
            strokeDashoffset: reverse ? 1000 : -1000,
          }}
          transition={{
            delay,
            duration,
            ease: "linear",
            repeat: Infinity,
          }}
        />
      </svg>
    );
  },
);

AnimatedBeam.displayName = "AnimatedBeam";