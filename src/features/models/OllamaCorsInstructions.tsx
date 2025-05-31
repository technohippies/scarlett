import { Component, Switch, Match } from 'solid-js';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { getOS } from '../../lib/os';

export interface OllamaCorsInstructionsProps {
  _forceOS?: 'linux' | 'macos' | 'windows' | 'unknown';
}

export const OllamaCorsInstructions: Component<OllamaCorsInstructionsProps> = (props) => {
  const os = props._forceOS || getOS();
  console.log(`[OllamaCorsInstructions] Displaying instructions for OS: ${os}`);
  return (
    <div class="w-full max-w-lg">
      <Switch fallback={<p class="text-xs text-muted-foreground">Instructions not available.</p>}>
        <Match when={os === 'linux'}>
          {/* Linux instructions */}
          <div class="space-y-2">
            <p>1. Copy paste into Terminal</p>
            <CodeBlock language="bash" code="sudo systemctl edit ollama.service" />
            <p>2. Copy and paste this under [Service]</p>
            <CodeBlock language="plaintext" code={'Environment="OLLAMA_HOST=0.0.0.0"\nEnvironment="OLLAMA_ORIGINS=*"'} />
            <p>3. Save, exit, restart</p>
            <CodeBlock language="bash" code="sudo systemctl restart ollama" />
          </div>
        </Match>
        <Match when={os === 'macos'}>
          {/* macOS instructions */}
          <div class="space-y-2">
                <p>1. Copy paste into Terminal</p>
                <div>
                  <CodeBlock language="bash" code={'launchctl setenv OLLAMA_HOST "0.0.0.0" && launchctl setenv OLLAMA_ORIGINS "*"'} /> 
                </div>
                <p>2. Restart Ollama (quit and open)</p>
            </div>
        </Match>
        <Match when={os === 'windows'}>
          {/* Windows instructions */}
          <div class="space-y-2">
                <p>1. Open System Properties &gt; Environment Variables</p>
                <p>2. Under "System variables", click "New...".</p>
                <p>3. Add Variable name: <code class="bg-neutral-700 px-1 py-0.5 rounded">OLLAMA_HOST</code>, Value: <code class="bg-neutral-700 px-1 py-0.5 rounded">0.0.0.0</code></p>
                <p>4. Add Variable name: <code class="bg-neutral-700 px-1 py-0.5 rounded">OLLAMA_ORIGINS</code>, Value: <code class="bg-neutral-700 px-1 py-0.5 rounded">*</code></p>
                <p>5. Click OK, then restart Ollama</p>
                <img 
                    src="/images/ollama-cors-windows.png"
                    alt="Ollama Windows Environment Variables settings"
                    class="mt-4 rounded border border-neutral-700"
                />
            </div>
        </Match>
        <Match when={os === 'unknown'}>
          <p class="text-xs text-muted-foreground">Could not detect OS for specific Ollama instructions. Please consult Ollama documentation for enabling CORS.</p>
        </Match>
      </Switch>
    </div>
  );
};

export default OllamaCorsInstructions; 