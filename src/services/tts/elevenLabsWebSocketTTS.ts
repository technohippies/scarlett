export interface ElevenLabsWSAlignment {
  charStartTimesMs: number[];
  charsDurationsMs: number[];
  chars: string[];
}

export interface ElevenLabsWSMessage {
  audio?: string;
  normalizedAlignment?: ElevenLabsWSAlignment;
  alignment?: ElevenLabsWSAlignment;
}

export interface ElevenLabsWebSocketTTSConfig {
  voiceId: string;
  apiKey: string;
  modelId?: string;
  outputFormat?: string;
  autoMode?: boolean;
  syncAlignment?: boolean;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    speed?: number;
  };
}

export class ElevenLabsWebSocketTTS {
  private ws: WebSocket;
  private audioCtx: AudioContext;
  private voiceSettings?: ElevenLabsWebSocketTTSConfig['voiceSettings'];
  private messageQueue: Array<{ text: string; try_trigger_generation: boolean }>;

  constructor(config: ElevenLabsWebSocketTTSConfig) {
    const {
      voiceId,
      apiKey,
      modelId = 'eleven_multilingual_v2',
      outputFormat = 'webm_opus_48000_160',
      autoMode = true,
      syncAlignment = true,
      voiceSettings
    } = config;
    this.voiceSettings = voiceSettings;
    const params = new URLSearchParams({
      authorization: apiKey,
      'xi-api-key': apiKey,
      model_id: modelId,
      output_format: outputFormat,
      auto_mode: autoMode.toString(),
      sync_alignment: syncAlignment.toString(),
      apply_text_normalization: 'auto',
      inactivity_timeout: '180'
    });
    const url = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?${params}`;
    console.log('[ElevenLabsWS] Connecting to', url);
    this.ws = new WebSocket(url);
    this.audioCtx = new AudioContext({ sampleRate: 48000 });
    this.messageQueue = [];
    this.ws.addEventListener('message', this.handleMessage.bind(this));
    this.ws.addEventListener('open', () => {
      if (this.voiceSettings) {
        this.ws.send(JSON.stringify({ text: '', voice_settings: this.voiceSettings }));
      }
      this.audioCtx.resume().catch(console.error);
      this.messageQueue.forEach(msg => this.ws.send(JSON.stringify(msg)));
      this.messageQueue = [];
    });
    this.ws.addEventListener('close', () => console.log('[ElevenLabsWS] WebSocket closed'));
  }

  private handleMessage(event: MessageEvent) {
    try {
      const msg: ElevenLabsWSMessage = JSON.parse(event.data);
      if (msg.audio) {
        const bytes = Uint8Array.from(atob(msg.audio), c => c.charCodeAt(0));
        console.log('[ElevenLabsWS] Received audio chunk, length:', bytes.byteLength);
        this.audioCtx.decodeAudioData(bytes.buffer.slice(0), buffer => {
          const src = this.audioCtx.createBufferSource();
          src.buffer = buffer;
          src.connect(this.audioCtx.destination);
          src.start();
        }, err => console.error('[ElevenLabsWS] decodeAudioData error', err));
      }
    } catch (e) {
      console.error('[ElevenLabsWS] Failed to handle message', e);
    }
  }

  sendText(text: string, tryTriggerGeneration = false) {
    const payload = { text, try_trigger_generation: tryTriggerGeneration };
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      this.messageQueue.push(payload);
    }
  }

  close() {
    if (this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify({ text: '' })); } catch {}
      this.ws.close();
    }
  }
} 