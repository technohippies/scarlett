import { Component, createEffect, createMemo } from 'solid-js';

export interface SpeechVisualizerProps {
  listening: boolean;
  processing: boolean;
  speaking: boolean;
  audioLevel: number;
}

export const SpeechVisualizer: Component<SpeechVisualizerProps> = (props) => {
  createEffect(() => {
    // This log helps confirm props are received and component is reacting
    console.log('[SpeechVisualizer] Props received:', {
      listening: props.listening,
      processing: props.processing,
      speaking: props.speaking,
      audioLevel: props.audioLevel,
    });
  });

  const visualizerClass = createMemo(() => {
    if (props.processing) {
      return 'processing';
    }
    if (props.speaking) {
      return 'speaking';
    }
    if (props.listening) {
      return 'listening';
    }
    return 'idle';
  });

  const visualizerStyle = createMemo(() => {
    if (props.speaking) {
      const scale = 1 + props.audioLevel * 0.8;
      return { transform: `scale(${scale})` };
    }
    return {};
  });

  return (
    <>
      <style>{`
        @keyframes pulse-listening {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.3); opacity: 0.4; }
        }
        @keyframes pulse-processing {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.6; }
        }

        .speech-visualizer-base {
          border-radius: 50%;
          margin: auto;
          transition: width 0.2s ease-in-out, 
                      height 0.2s ease-in-out, 
                      background-color 0.2s ease-in-out, 
                      opacity 0.2s ease-in-out,
                      transform 0.1s ease-out; 
        }

        .speech-visualizer-base.idle {
          width: 16px;
          height: 16px;
          background-color: #9ca3af; /* Tailwind gray-400 */
          opacity: 0.6;
        }

        .speech-visualizer-base.listening {
          width: 20px;
          height: 20px;
          background-color: #3b82f6; /* Tailwind blue-500 */
          animation: pulse-listening 1.5s ease-in-out infinite;
        }

        .speech-visualizer-base.processing {
          width: 24px;
          height: 24px;
          background-color: #f59e0b; /* Tailwind amber-500 */
          animation: pulse-processing 1s ease-in-out infinite;
        }

        .speech-visualizer-base.speaking {
          width: 32px; 
          height: 32px;
          background-color: #22d3ee; /* Tailwind cyan-400 */
        }
      `}</style>
      <div
        class={`speech-visualizer-base ${visualizerClass()}`}
        style={visualizerStyle()}
      />
    </>
  );
}; 