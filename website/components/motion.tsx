"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

type Tag = "div" | "span" | "section" | "li";

// True once the element has scrolled into view; never resets.
function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, shown] as const;
}

// Fades, lifts and un-blurs its children the first time they scroll into view.
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Element = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: Tag;
}) {
  const [ref, shown] = useInView<HTMLElement>();
  return (
    <Element
      ref={ref as never}
      data-shown={shown}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${className}`}
    >
      {children}
    </Element>
  );
}

type Counter = { index: number };

// Wraps every character in its own span, keeping words together so lines still wrap at spaces.
// Elements marked data-unit (icon pills) animate as a single piece.
function splitChildren(node: ReactNode, counter: Counter): ReactNode {
  return Children.map(node, (child) => {
    if (typeof child === "string") {
      return child.split(/(\s+)/).map((part, partIndex) =>
        !part || /^\s+$/.test(part) ? (
          part
        ) : (
          <span key={partIndex} className="inline-block whitespace-nowrap">
            {[...part].map((character, characterIndex) => (
              <span key={characterIndex} className="char" style={{ "--i": counter.index++ } as CSSProperties}>
                {character}
              </span>
            ))}
          </span>
        ),
      );
    }
    if (isValidElement(child)) {
      const element = child as ReactElement<{ children?: ReactNode; "data-unit"?: unknown }>;
      if (element.props["data-unit"] !== undefined) {
        return (
          <span className="char" style={{ "--i": counter.index++ } as CSSProperties}>
            {element}
          </span>
        );
      }
      return cloneElement(element, undefined, splitChildren(element.props.children, counter));
    }
    return child;
  });
}

// Reveals text one character at a time: each letter fades in, rises and un-blurs.
export function RevealText({
  children,
  delay = 0,
  className = "",
  as: Element = "span",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: Tag;
}) {
  const [ref, shown] = useInView<HTMLElement>();
  return (
    <Element
      ref={ref as never}
      data-shown={shown}
      style={{ "--delay": `${delay}ms` } as CSSProperties}
      className={`reveal-text ${className}`}
    >
      {/* Screen readers get the plain text instead of separate letters. */}
      <span className="sr-only">{children}</span>
      <span aria-hidden>{splitChildren(children, { index: 0 })}</span>
    </Element>
  );
}

// Counts up to a number once it is visible.
export function CountUp({ to, suffix = "", duration = 1200 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const length = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const progress = length ? Math.min(1, (now - start) / length) : 1;
        setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to, duration]);
  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}
