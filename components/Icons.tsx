import type { SVGProps } from "react";

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6.5 10.8V20a1.5 1.5 0 0 0 1.5 1.5h8A1.5 1.5 0 0 0 17.5 20v-9.2" />
      <path d="M10 21v-6.2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V21" />
    </Base>
  );
}

export function IconSpread(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M7 6.5h8.5A2.5 2.5 0 0 1 18 9v11H9.5A2.5 2.5 0 0 1 7 17.5v-11Z" />
      <path d="M18 9h.5A2.5 2.5 0 0 1 21 11.5V20h-3" />
      <path d="M10 10.3h5" />
      <path d="M10 13.2h5" />
    </Base>
  );
}

export function IconDeck(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M7.2 5.3h9.6a2.2 2.2 0 0 1 2.2 2.2v11.2a2.2 2.2 0 0 1-2.2 2.2H7.2A2.2 2.2 0 0 1 5 18.7V7.5a2.2 2.2 0 0 1 2.2-2.2Z" />
      <path d="M8.8 9.2h6.4" />
      <path d="M8.8 12h6.4" />
      <path d="M8.8 14.8h4.6" />
    </Base>
  );
}

export function IconArchive(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M5.5 7h13a1.5 1.5 0 0 1 1.5 1.5V11H4V8.5A1.5 1.5 0 0 1 5.5 7Z" />
      <path d="M6 11v9a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 20v-9" />
      <path d="M10 15.2h4" />
    </Base>
  );
}

export function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Base>
  );
}

export function IconChevronRight(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M10 7l5 5-5 5" />
    </Base>
  );
}
