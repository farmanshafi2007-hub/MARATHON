import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";

export function MapPolyline({ path, strokeColor = "#0051ff" }: { path: google.maps.LatLngLiteral[], strokeColor?: string }) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!polylineRef.current) {
      polylineRef.current = new google.maps.Polyline({
        path: [], // Start empty for animation
        strokeColor,
        strokeOpacity: 0.8,
        strokeWeight: 4.5,
      });

      // Animate drawing the path on initial mount
      let step = 0;
      const drawFrame = () => {
        if (step < path.length) {
          const currentPath = path.slice(0, step + 1);
          polylineRef.current?.setPath(currentPath);
          step += Math.max(1, Math.floor(path.length / 30)); // 30 frames roughly
          requestAnimationFrame(drawFrame);
        } else {
          polylineRef.current?.setPath(path);
        }
      };
      if (path.length > 0) {
        requestAnimationFrame(drawFrame);
      }
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
