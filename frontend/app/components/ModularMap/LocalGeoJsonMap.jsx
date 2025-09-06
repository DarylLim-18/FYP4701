'use client';

import dynamic from 'next/dynamic';

const LocalGeoJsonMapInner = dynamic(
  () => import('./LocalGeoJsonMapInner'),
  { ssr: false }
);

export default function LocalGeoJsonMap(props) {
  return <LocalGeoJsonMapInner {...props} />;
}
