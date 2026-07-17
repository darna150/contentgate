export function nextRovingIndex(
  currentIndex: number,
  key: string,
  count: number
): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (currentIndex + 1 + count) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (currentIndex - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
