/** Small line icons drawn with currentColor, so they follow the surrounding text color. */
import type { ReactNode } from 'react'

const common = {
  viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
} as const

/** Speech bubble: comments. */
export function CommentIcon(): ReactNode {
  return <svg {...common}><path d="M3 3.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8.5L5.5 14v-2.5H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" /><path d="M5 6.5h6M5 8.75h4" /></svg>
}

/** Opening quotation mark: quote without comment. */
export function QuoteIcon(): ReactNode {
  return <svg {...common}><path d="M3 9.5c0-2.5 1-4 3-4.5M3 9.5h2.5V12H3V9.5ZM9 9.5c0-2.5 1-4 3-4.5M9 9.5h2.5V12H9V9.5Z" /></svg>
}

/** Paper plane: send. */
export function SendIcon(): ReactNode {
  return <svg {...common}><path d="M14 2 7 9M14 2l-4.5 12-2.5-5-5-2.5L14 2Z" /></svg>
}

/** Arrow into a tray: insert into the composer. */
export function InsertIcon(): ReactNode {
  return <svg {...common}><path d="M8 2v7.5M5 6.5l3 3 3-3M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" /></svg>
}

/** Chevron pointing up or down. */
export function ChevronIcon({ up }: { readonly up: boolean }): ReactNode {
  return <svg {...common}><path d={up ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} /></svg>
}

/** Minus: zoom out. */
export function MinusIcon(): ReactNode {
  return <svg {...common}><path d="M3.5 8h9" /></svg>
}

/** Plus: zoom in. */
export function PlusIcon(): ReactNode {
  return <svg {...common}><path d="M3.5 8h9M8 3.5v9" /></svg>
}

/** Crosshair: locate. */
export function LocateIcon(): ReactNode {
  return <svg {...common}><circle cx="8" cy="8" r="4.5" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" /></svg>
}

/** Pencil: edit. */
export function EditIcon(): ReactNode {
  return <svg {...common}><path d="M10.5 3 13 5.5 6 12.5H3.5V10L10.5 3Z" /></svg>
}

/** Trash can: delete. */
export function TrashIcon(): ReactNode {
  return <svg {...common}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 9h6l.5-9" /></svg>
}
