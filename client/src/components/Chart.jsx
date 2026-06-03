import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

// Thin React wrapper around Chart.js: rebuilds the chart whenever `config`
// changes and tears it down on unmount.
export default function ChartCanvas({ config }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = new Chart(canvasRef.current.getContext("2d"), config);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [config]);

  return <canvas ref={canvasRef} />;
}
