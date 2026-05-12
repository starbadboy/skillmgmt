import type { ReactElement, SVGProps } from "react";
import type { AgentId } from "./types";

const props: SVGProps<SVGSVGElement> = { viewBox: "0 0 24 24", "aria-hidden": true };

export const AgentIcon: Record<AgentId, (p?: SVGProps<SVGSVGElement>) => ReactElement> = {
  claude: (p) => (
    <svg {...props} {...p} fill="currentColor">
      <path d="M12 1.5c-.55 5.2-2.8 7.45-8 8 5.2.55 7.45 2.8 8 8 .55-5.2 2.8-7.45 8-8-5.2-.55-7.45-2.8-8-8z" />
    </svg>
  ),
  codex: (p) => (
    <svg {...props} {...p} fill="none" stroke="currentColor" strokeWidth={1.6}>
      <ellipse cx="12" cy="12" rx="9" ry="3.6" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" />
    </svg>
  ),
  cursor: (p) => (
    <svg {...props} {...p} fill="currentColor">
      <path d="M5.5 3.2 19 11.4l-7 1.1-2.9 6.8z" />
    </svg>
  ),
  antigravity: (p) => (
    <svg {...props} {...p} fill="none" stroke="currentColor" strokeWidth={1.6}>
      <ellipse cx="12" cy="12" rx="9.5" ry="3.6" transform="rotate(-25 12 12)" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  ),
};
