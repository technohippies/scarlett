import { Component, createSignal, createEffect, onCleanup } from 'solid-js';

export interface MicVisualizerProps {
  /** When true, start animating the waveform */
  active: boolean;
  /** Number of points in the waveform */
  barCount?: number;
  /** Height of the waveform in pixels */
  maxHeight?: number;
  /** Animation update interval in milliseconds */
  interval?: number;
}

export const MicVisualizer: Component<MicVisualizerProps> = (props) => {
  const pointCount = props.barCount ?? 50;
  const svgHeight = props.maxHeight ?? 30;
  const intervalMs = props.interval ?? 100;

  // waveform values: each between -1 and 1
  const [values, setValues] = createSignal<number[]>(Array(pointCount).fill(0));
  let timer: number | undefined;

  const updateWaveform = () => {
    setValues(
      Array(pointCount)
        .fill(0)
        .map(() => Math.random() * 2 - 1) // random between -1 and 1
    );
  };

  createEffect(() => {
    if (props.active) {
      updateWaveform();
      timer = window.setInterval(updateWaveform, intervalMs);
    } else {
      if (timer) window.clearInterval(timer);
      setValues(Array(pointCount).fill(0));
    }
  });

  onCleanup(() => {
    if (timer) window.clearInterval(timer);
  });

  // Render SVG waveform
  const pointsAttr = () =>
    values()
      .map((v, i) => {
        const x = i;
        const y = svgHeight / 2 - v * (svgHeight / 2);
        return `${x},${y}`;
      })
      .join(' ');
  return (
    <svg
      class="w-full"
      style={{ height: `${svgHeight}px` }}
      viewBox={`0 0 ${pointCount - 1} ${svgHeight}`}
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke="white"
        stroke-width="1"
        points={pointsAttr()}
      />
    </svg>
  );
}; 