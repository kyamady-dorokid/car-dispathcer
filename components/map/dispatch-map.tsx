"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapVehicle = {
  id: number;
  plateNumber: string;
  type: string;
  baseLat: number;
  baseLng: number;
  status: string;
  busy: boolean;
};

export type MapOrder = {
  id: number;
  customerName: string;
  cargo: string;
  requiredVehicleType: string;
  originLat: number;
  originLng: number;
};

export const VEHICLE_COLORS: Record<string, string> = {
  "2t": "#22c55e",
  "4t": "#3b82f6",
  "10t": "#f97316",
  trailer: "#ef4444",
};

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );
}

export function DispatchMap({
  vehicles,
  orders,
  center = [135.502, 34.694],
  zoom = 10,
}: {
  vehicles: MapVehicle[];
  orders: MapOrder[];
  center?: [number, number];
  zoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          gsi: {
            type: "raster",
            tiles: ["https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank' rel='noreferrer'>地理院タイル</a>",
          },
        },
        layers: [{ id: "gsi", type: "raster", source: "gsi" }],
      },
      center,
      zoom,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      // 未割当案件マーカー (赤いピン)
      for (const o of orders) {
        const el = document.createElement("div");
        el.style.cssText =
          "width:14px;height:14px;border-radius:50% 50% 50% 0;background:#ef4444;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer;";
        const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
          `<div style="font-size:12px;line-height:1.6">
            <div style="font-weight:700;color:#b91c1c">未割当案件 #${o.id}</div>
            <div>${esc(o.customerName)}</div>
            <div>品目: ${esc(o.cargo)}</div>
            <div>必要車両: <b>${esc(o.requiredVehicleType)}</b></div>
          </div>`
        );
        new maplibregl.Marker({ element: el })
          .setLngLat([o.originLng, o.originLat])
          .setPopup(popup)
          .addTo(map);
      }

      // 車両マーカー (タイプ別色分けの円)
      for (const v of vehicles) {
        const color = VEHICLE_COLORS[v.type] ?? "#64748b";
        const el = document.createElement("div");
        el.style.cssText = `width:24px;height:24px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;cursor:pointer;${v.busy ? "opacity:.5" : ""}`;
        el.textContent = v.type;
        const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
          `<div style="font-size:12px;line-height:1.6">
            <div style="font-weight:700">${esc(v.plateNumber)}</div>
            <div>車両タイプ: <b>${esc(v.type)}</b></div>
            <div>状態: ${v.busy ? "<span style='color:#2563eb'>運行中</span>" : "<span style='color:#16a34a'>待機中</span>"}</div>
          </div>`
        );
        new maplibregl.Marker({ element: el })
          .setLngLat([v.baseLng, v.baseLat])
          .setPopup(popup)
          .addTo(map);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [vehicles, orders, center, zoom]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden rounded-lg border"
    />
  );
}
