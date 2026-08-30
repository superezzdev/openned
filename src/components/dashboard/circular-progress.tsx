"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number; // 0 to 100
  size?: number; // width & height in px
  strokeWidth?: number; // stroke width in px
  color?: string; // custom hex or css color
  trackColor?: string; // background ring color
  className?: string;
  showValue?: boolean;
  valueSuffix?: string;
  valueClassName?: string;
  children?: React.ReactNode;
}

export function CircularProgress({
  value = 0,
  size = 64,
  strokeWidth = 6,
  color,
  trackColor = "rgba(255, 255, 255, 0.08)",
  className,
  showValue = false,
  valueSuffix = "%",
  valueClassName,
  children,
}: CircularProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  // Default color based on percentage if not explicitly overridden
  let defaultColor = "#F59E0B"; // Amber
  let glowColor = "rgba(245, 158, 11, 0.25)";

  if (clampedValue >= 85) {
    defaultColor = "#10B981"; // Emerald
    glowColor = "rgba(16, 185, 129, 0.25)";
  } else if (clampedValue >= 60) {
    defaultColor = "#06B6D4"; // Cyan
    glowColor = "rgba(6, 182, 212, 0.25)";
  } else if (clampedValue >= 35) {
    defaultColor = "#3B82F6"; // Blue
    glowColor = "rgba(59, 130, 246, 0.25)";
  }

  const activeColor = color || defaultColor;
  const uniqueId = React.useId().replace(/:/g, "");

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center select-none shrink-0",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90 origin-center"
      >
        <defs>
          <linearGradient
            id={`progress-grad-${uniqueId}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor={activeColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={activeColor} stopOpacity="1" />
          </linearGradient>
          <filter id={`glow-${uniqueId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="2"
              floodColor={activeColor}
              floodOpacity="0.3"
            />
          </filter>
        </defs>

        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Animated Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#progress-grad-${uniqueId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          filter={`url(#glow-${uniqueId})`}
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        {children ? (
          children
        ) : showValue ? (
          <span
            className={cn(
              "font-mono font-bold text-white tracking-tight leading-none",
              valueClassName
            )}
            style={{ fontSize: Math.max(10, size * 0.26) }}
          >
            {Math.round(clampedValue)}
            <span className="text-[0.65em] opacity-70 font-sans font-normal ml-0.5">
              {valueSuffix}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
