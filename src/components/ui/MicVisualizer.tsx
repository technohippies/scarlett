import { Component, createSignal, createEffect, onCleanup } from 'solid-js';

export interface MicVisualizerProps {
  /** When true, start animating the bars */
  active: boolean;
  /** Number of bars to display */
  barCount?: number;
  /** Maximum height of bars in pixels */
  maxHeight?: number;
  /** Minimum height of bars in pixels */
  minHeight?: number;
  /** Animation update interval in milliseconds */
  interval?: number;
}

export const MicVisualizer: Component<MicVisualizerProps> = (props) => {
  const bars = props.barCount ?? 20;
  const maxH = props.maxHeight ?? 30;
  const minH = props.minHeight ?? 4;
  const intervalMs = props.interval ?? 100;

  // heights for each bar
  const [heights, setHeights] = createSignal<number[]>(Array(bars).fill(minH));
  let timer: number | undefined;

  const updateHeights = () => {
    setHeights(
      Array(bars)
        .fill(0)
        .map(() => Math.random() * (maxH - minH) + minH)
    );
  };

  createEffect(() => {
    if (props.active) {
      updateHeights();
      timer = window.setInterval(updateHeights, intervalMs);
    } else {
      if (timer) window.clearInterval(timer);
      setHeights(Array(bars).fill(minH));
    }
  });

  onCleanup(() => {
    if (timer) window.clearInterval(timer);
  });

  return (
    <div class="flex items-end space-x-1 h-10">
      {heights().map((h, i) => (
        <div
          key={i}
          class="bg-white w-1 rounded-sm"
          style={{ height: `${h}px`, transition: `height ${intervalMs}ms ease-in-out` }}
        />
      ))}
    </div>
  );
}; 