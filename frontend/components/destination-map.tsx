"use client";

import dynamic from "next/dynamic";

import type { MapData } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map-view"), {
  ssr: false,
  loading: () => <div className="skeleton h-[420px] w-full" />,
});

export function DestinationMap({ data, height = 420 }: { data: MapData; height?: number }) {
  return <MapView data={data} height={height} />;
}
