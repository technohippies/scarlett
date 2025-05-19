import { Component, onCleanup, onMount } from 'solid-js';

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
  let canvasRef: HTMLCanvasElement | undefined;
  let animationId: number | undefined;
  let audioContext: AudioContext | undefined;
  let analyser: AnalyserNode | undefined;
  let dataArray: Uint8Array | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let streamRef: MediaStream | undefined; // To keep track of the stream for cleanup

  const width = 120; // Canvas internal resolution, will be scaled by style
  const height = props.maxHeight ?? 32;

  async function setupAudio() {
    if (audioContext) return; // Already setup
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256; // Lowered for simplicity, can be tuned
      analyser.smoothingTimeConstant = 0.3; // Smoother transitions
      dataArray = new Uint8Array(analyser.frequencyBinCount); // Use frequencyBinCount for waveform data

      streamRef = await navigator.mediaDevices.getUserMedia({ audio: true });
      source = audioContext.createMediaStreamSource(streamRef);
      source.connect(analyser);
      console.log('[MicVisualizer] Audio context and analyser setup complete.');
    } catch (err) {
      console.error('[MicVisualizer] Error setting up audio:', err);
      audioContext = undefined; // Reset on error
    }
  }

  function drawWaveform() {
    if (!canvasRef || !analyser || !dataArray) return;
    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    analyser.getByteTimeDomainData(dataArray); // Get waveform data

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'white';
    ctx.beginPath();

    const sliceWidth = width * 1.0 / analyser.frequencyBinCount;
    let x = 0;

    for (let i = 0; i < analyser.frequencyBinCount; i++) {
      const v = dataArray[i] / 128.0; // dataArray values are 0-255
      const y = v * height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    ctx.lineTo(width, height / 2); // Ensure line extends to full width
    ctx.stroke();
  }
  
  function drawFlatLine() {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  async function animate() {
    if (props.active) {
      if (!audioContext) {
        await setupAudio();
      }
      if (audioContext && analyser && dataArray) {
        drawWaveform();
      }
    } else {
      if (audioContext) { // If transitioning from active to inactive
        cleanupAudio(); 
      }
      drawFlatLine();
    }
    animationId = requestAnimationFrame(animate);
  }
  
  function cleanupAudio() {
    console.log('[MicVisualizer] Cleaning up audio resources.');
    if (source) {
      source.disconnect();
      source = undefined;
    }
    if (streamRef) {
      streamRef.getTracks().forEach(track => track.stop());
      streamRef = undefined;
    }
    if (analyser) {
      analyser.disconnect();
      analyser = undefined;
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(e => console.error('[MicVisualizer] Error closing AudioContext:', e));
    }
    audioContext = undefined;
    dataArray = undefined;
  }

  onMount(() => {
    animate();
  });

  onCleanup(() => {
    if (animationId) cancelAnimationFrame(animationId);
    cleanupAudio();
  });

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: '100%', height: `${height}px`, display: 'block' }}
    />
  );
}; 