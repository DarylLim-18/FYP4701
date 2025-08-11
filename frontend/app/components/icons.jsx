import React from 'react';

export const BrainLogo = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    shapeRendering="geometricPrecision"
    {...props}
  >
    <g vectorEffect="non-scaling-stroke">
      {/* left lobe */}
      <path d="M9 3a3 3 0 0 0-3 3v.5A3.5 3.5 0 0 0 3.5 10v0A3.5 3.5 0 0 0 6 13.5V16a3 3 0 0 0 6 0V5a2 2 0 0 0-2-2z" />
      {/* right lobe (mirrored) */}
      <path d="M15 3a3 3 0 0 1 3 3v.5A3.5 3.5 0 0 1 20.5 10v0A3.5 3.5 0 0 1 18 13.5V16a3 3 0 0 1-6 0V5a2 2 0 0 1 2-2z" />
      {/* central connections */}
      <path d="M12 6v12" />
      <path d="M8.5 9.5H12M12 14.5h3.5" />
    </g>
  </svg>
)

export const DatabaseIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5V19A9 3 0 0 0 21 19V5"/>
    <path d="M3 12A9 3 0 0 0 21 12"/>
  </svg>
);

export const SlidersIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/>
    <line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/>
    <line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/>
    <line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/>
    <line x1="17" x2="23" y1="16" y2="16"/>
  </svg>
);

export const AtomIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="1"/>
    <path d="M20.2 20.2c2.04-2.04 3.25-4.82 3.25-7.72 0-6.07-4.93-11-11-11S1.25 6.43 1.25 12.5c0 2.9 1.21 5.68 3.25 7.72"/>
    <path d="M12.5 1.25c2.04 2.04 3.25 4.82 3.25 7.72 0 6.07-4.93 11-11 11S1.25 18.57 1.25 12.5c0-2.9 1.21-5.68 3.25-7.72"/>
  </svg>
);

export const ChartLineIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
  </svg>
);

export const ClassifierIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 3v18"/><path d="M3 12h18"/><path d="M3 7h5"/><path d="M16 7h5"/><path d="M3 17h5"/><path d="M16 17h5"/>
  </svg>
);

export const LoaderIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);
