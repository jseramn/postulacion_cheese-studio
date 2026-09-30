"use client";

import { useEffect } from "react";

export function WisprFlowOverflowUnlock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      htmlMinHeight: html.style.minHeight,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyMinHeight: body.style.minHeight,
    };

    html.style.overflow = "auto";
    html.style.height = "auto";
    html.style.minHeight = "100%";
    body.style.overflow = "auto";
    body.style.height = "auto";
    body.style.minHeight = "100%";

    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.height = prev.htmlHeight;
      html.style.minHeight = prev.htmlMinHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      body.style.minHeight = prev.bodyMinHeight;
    };
  }, []);

  return null;
}
