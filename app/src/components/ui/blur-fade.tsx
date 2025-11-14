"use client";

import { motion } from "framer-motion";
import React from "react";

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  variant?: {
    hidden: { y?: number; opacity?: number; filter?: string };
    visible: { y?: number; opacity?: number; filter?: string };
  };
  duration?: number;
  delay?: number;
  yOffset?: number;
  inView?: boolean;
}

const BlurFade: React.FC<BlurFadeProps> = ({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  yOffset = 6,
  inView = false,
}) => {
  const defaultVariants = {
    hidden: { y: yOffset, opacity: 0, filter: "blur(6px)" },
    visible: { y: 0, opacity: 1, filter: "blur(0px)" },
  };

  const combinedVariants = variant || defaultVariants;

  return (
    <motion.div
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      whileInView="visible"
      viewport={{ once: true }}
      transition={{ duration, delay, ease: "easeOut" }}
      variants={combinedVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default BlurFade;