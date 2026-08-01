import type { ReactNode } from "react";

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function ActivityIcon() {
  return <Icon><path d="M3 12h4l2.2-6 4.1 12 2.2-6H21" /></Icon>;
}

export function BrainIcon() {
  return <Icon><path d="M9.5 4.2A3.2 3.2 0 0 0 4 6.4a3.5 3.5 0 0 0 1 6.8A3.5 3.5 0 0 0 9.5 19" /><path d="M14.5 4.2A3.2 3.2 0 0 1 20 6.4a3.5 3.5 0 0 1-1 6.8 3.5 3.5 0 0 1-4.5 5.8" /><path d="M9.5 4v16M14.5 4v16M7 9h2.5M14.5 9H17M7 15h2.5M14.5 15H17" /></Icon>;
}

export function CameraIcon() {
  return <Icon><path d="M4 7h3l1.5-2h7L17 7h3v11H4z" /><circle cx="12" cy="12.5" r="3.3" /></Icon>;
}

export function ChevronIcon() {
  return <Icon size={15}><path d="m9 18 6-6-6-6" /></Icon>;
}

export function CloseIcon() {
  return <Icon><path d="m6 6 12 12M18 6 6 18" /></Icon>;
}

export function CommandIcon() {
  return <Icon><rect x="3.5" y="4" width="17" height="16" rx="3" /><path d="M8 9h8M8 13h5M8 17h3" /></Icon>;
}

export function HandIcon() {
  return <Icon><path d="M7.5 12V5.5a1.5 1.5 0 0 1 3 0V10M10.5 9V4.5a1.5 1.5 0 0 1 3 0V10M13.5 9V5.5a1.5 1.5 0 0 1 3 0v6M16.5 10V8a1.5 1.5 0 0 1 3 0v5.5c0 4-2.4 6.5-6.3 6.5h-1.1c-2 0-3.1-.8-4.4-2.4L4.8 14a1.6 1.6 0 0 1 2.3-2.2z" /></Icon>;
}

export function RefreshIcon() {
  return <Icon><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 9A7 7 0 0 1 18.3 6.5L20 12M4 12l1.7 5.5A7 7 0 0 0 17.9 15" /></Icon>;
}

export function SessionIcon() {
  return <Icon><path d="M5 5h14v14H5z" /><path d="M8 9h8M8 13h5" /></Icon>;
}
