import { Tooltip } from "@blueprintjs/core";
import type { JSX, ReactNode } from "react";

interface DataTooltipProps {
  children: ReactNode;
  content: string | JSX.Element;
}

export function DataTooltip({ children, content }: DataTooltipProps) {
  return (
    <Tooltip content={content} hoverOpenDelay={180} interactionKind="hover-target">
      <div className="data-tooltip-target">{children}</div>
    </Tooltip>
  );
}
