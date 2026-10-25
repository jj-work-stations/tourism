"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { Rating } from "@/components/ui";
import type { MapData } from "@/lib/types";

const COLORS: Record<string, string> = {
  destination: "#0e7c66",
  accommodation: "#b78e5d",
  attraction: "#0ea5e9",
  restaurant: "#f59e0b",
  experience: "#8b5cf6",
};

const LABELS: Record<string, string> = {
  destination: "مقصد",
  accommodation: "اقامتگاه",
  attraction: "جاذبه",
  restaurant: "رستوران",
  experience: "تجربه",
};

export default function MapView({ data, height = 420 }: { data: MapData; height?: number }) {
  const center: [number, number] = [data.center.lat, data.center.lng];
  return (
    <div className="overflow-hidden rounded-3xl border border-black/5" style={{ height }}>
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {data.markers.map((marker) => (
          <CircleMarker
            key={marker.id}
            center={[marker.lat, marker.lng]}
            radius={marker.type === "destination" ? 12 : 8}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: COLORS[marker.type] || "#0e7c66",
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontSize: 11, color: COLORS[marker.type] || "#0e7c66", fontWeight: 700 }}>
                  {LABELS[marker.type] || marker.type}
                </div>
                <div style={{ fontWeight: 800, marginTop: 2 }}>{marker.name}</div>
                {marker.rating ? (
                  <div style={{ marginTop: 4 }}>
                    <Rating value={marker.rating} size="sm" />
                  </div>
                ) : null}
                {marker.price ? (
                  <div style={{ marginTop: 4, fontSize: 11, color: "#0e7c66" }}>
                    از {new Intl.NumberFormat("fa-IR").format(marker.price)} تومان
                  </div>
                ) : null}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
