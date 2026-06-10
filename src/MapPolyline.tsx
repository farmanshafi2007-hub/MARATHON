import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";

export function MapPolyline({ path, strokeColor = "#0051ff" }: { path: google.maps.LatLngLiteral[], strokeColor?: string }) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!polylineRef.current) {
      polylineRef.current = new google.maps.Polyline({
        path,
        strokeColor,
        strokeOpacity: 0.8,
        strokeWeight: 4.5,
      });
    } else {
      polylineRef.current.setPath(path);
    }
  }, [path, strokeColor]);

  useEffect(() => {
    if (polylineRef.current && map) {
      polylineRef.current.setMap(map);
    }
    return () => {
      if (polylineRef.current) polylineRef.current.setMap(null);
    };
  }, [map]);

  return null;
}
