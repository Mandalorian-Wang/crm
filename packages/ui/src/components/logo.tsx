import type { SVGProps } from "react";

export default function Logo(props: SVGProps<SVGSVGElement>) {
 return <svg viewBox="-50 -57 100 114" fill="none" aria-label="BoxLite" {...props}>
  <path d="M0 -50L43.3 -25V25L0 50L-43.3 25V-25ZM-43.3 -25L-18.6 -10.7M43.3 -25L18.6 -10.7M0 50V21.5" stroke="currentColor" strokeWidth="3" />
  <path d="M0 -21.5L18.6 -10.7V10.7L0 21.5L-18.6 10.7V-10.7ZM-18.6 -10.7L0 0L18.6 -10.7M0 0V21.5" fill="#0098da" fillOpacity="0.12" stroke="#0098da" strokeWidth="4" />
 </svg>;
}
