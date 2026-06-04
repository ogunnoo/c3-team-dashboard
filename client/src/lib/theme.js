// Theme-aware palette for Chart.js. Returns axis/grid/surface colors plus the
// status hues so charts read well in both light and dark mode. Category hues
// (accepted/declined/etc.) are brightened slightly in dark mode for contrast.
export function chartColors(theme) {
  const dark = theme === "dark";
  return {
    grid: dark ? "#1b2e26" : "#eef2ef",
    axis: dark ? "#8ba599" : "#6b7d72",
    surface: dark ? "#101e19" : "#ffffff",
    accepted: dark ? "#22e08a" : "#16a34a",
    declined: dark ? "#ff7676" : "#ef4444",
    unresponsive: dark ? "#ffc857" : "#f59e0b",
    once: dark ? "#22e08a" : "#16a34a",
    twice: dark ? "#7ef0b6" : "#4ade80",
    more: dark ? "#15b86a" : "#166534",
    headCoach: dark ? "#22e08a" : "#16a34a",
    coach: dark ? "#5aa9ff" : "#2563eb",
    apprentice: dark ? "#ffc857" : "#d97706",
    orient: dark ? "#8b8bff" : "#6366f1",
  };
}
