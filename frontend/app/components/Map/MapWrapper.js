'use client';

import dynamic from 'next/dynamic';

// Dynamically import the Map with SSR disabled
const Map = dynamic(() => import('./index'), {
  ssr: false
});

export default function MapWrapper() {
  return <Map />;
}
