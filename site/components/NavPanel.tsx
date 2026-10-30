"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FocusEvent } from "react";

export type NavPanelItem = { href: string; label: string; count: number };

/**
 * The header's dropdown panels (Genres, Series): a link and a disclosure button.
 *
 * ADR-0008's first version made the label do both jobs — it was an anchor whose click was
 * `preventDefault`ed to pin the panel. That is a link pretending to be a button: a desktop
 * reader who meant "open the genre page" got a menu instead (ADR-0009). The label is a
 * link again, and a separate caret button owns the open state.
 *
 * What the reader gets:
 * - desktop: hover opens the panel after a short delay, and it survives the trip across
 *   the gap to the panel (a transparent hover bridge, plus a grace period on the way
 *   out); the caret pins it open;
 * - keyboard: focusing either control opens it, Escape closes it and returns focus to
 *   the link, and the caret is a real button with `aria-expanded`;
 * - touch and no-JavaScript: the label is a plain link to the same list as a page —
 *   /browse/#genres, /series/ — and the caret is a large, separate target.
 *
 * The open/close contract (state, outside-click close, Escape, ARIA) is what a component
 * library's menu primitive provides — hand-rolled with no dependency (ADR-0008, ADR-0009).
 */
export function NavPanel({
  label,
  href,
  items,
  allLabel,
  align = "start",
}: {
  label: string;
  /** Where the label goes: the same list as a page, for touch and no-JS readers. */
  href: string;
  items: NavPanelItem[];
  /** The panel's last row — the page version of the same list. */
  allLabel: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const timers = useRef<number[]>([]);
  /* A caret click pins the panel: it stays open after the pointer leaves, until Escape,
     an outside click or a navigation dismisses it. Hover alone still closes on leave. */
  const pinned = useRef(false);

  const cancel = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  /* Delays in and out keep a quick pass across the header from opening every panel, and
     a diagonal move toward the panel from closing the one that is open. */
  const openSoon = () => {
    cancel();
    later(() => setOpen(true), 120);
  };
  const openNow = () => {
    cancel();
    setOpen(true);
  };
  const closeNow = () => {
    cancel();
    pinned.current = false;
    setOpen(false);
  };
  const closeSoon = () => {
    cancel();
    later(() => {
      pinned.current = false;
      setOpen(false);
    }, 250);
  };

  /* The panel is a pointer affordance; a touch tap on the label keeps meaning the link. */
  const hoverCapable = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const onMouseEnter = () => {
    if (hoverCapable() && !pinned.current) openSoon();
  };
  const onMouseLeave = () => {
    if (hoverCapable() && !pinned.current) closeSoon();
  };
  const onFocus = () => openNow();
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!groupRef.current?.contains(event.relatedTarget as Node | null)) closeNow();
  };
  const onToggle = () => {
    if (open && pinned.current) {
      closeNow();
      return;
    }
    /* Hover usually opens the panel on the way in, so the first click means "keep it
       open", never "close it" — closing is a second click, Escape or an outside click. */
    pinned.current = true;
    setOpen(true);
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (groupRef.current && !groupRef.current.contains(event.target as Node)) {
        pinned.current = false;
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && groupRef.current?.contains(event.target as Node)) {
        pinned.current = false;
        setOpen(false);
        groupRef.current.querySelector("a")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (items.length === 0) {
    return (
      <Link className="nav__link" href={href}>
        {label}
      </Link>
    );
  }

  return (
    <div
      className="nav__group"
      data-open={open || undefined}
      ref={groupRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <Link className="nav__link" href={href}>
        {label}
      </Link>
      <button
        type="button"
        className="nav__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label + " menu"}
        onClick={onToggle}
      >
        <span className="nav__caret" aria-hidden="true" />
      </button>
      <div
        className={"nav__panel" + (align === "end" ? " nav__panel--right" : "")}
        id={panelId}
        onClickCapture={() => {
          pinned.current = false;
          setOpen(false);
        }}
      >
        <ul className="nav__panel-list">
          {items.map((item) => (
            <li key={item.href}>
              <Link className="nav__panel-link" href={item.href}>
                <span>{item.label}</span>
                <span className="nav__panel-count">
                  {item.count}
                  <span className="visually-hidden"> {item.count === 1 ? "story" : "stories"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link className="nav__panel-all" href={href}>
          {allLabel}
        </Link>
      </div>
    </div>
  );
}
