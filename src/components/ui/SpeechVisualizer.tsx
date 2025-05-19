import { Component } from 'solid-js';

export const SpeechVisualizer: Component = () => (
  <>
    <style>
      {`@keyframes sv-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.4); opacity: 0.4; }
      }
      .speech-visualizer {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: #61dafb;
        margin: auto;
        animation: sv-pulse 1.2s ease-in-out infinite;
      }`}
    </style>
    <div class="speech-visualizer" />
  </>
); 