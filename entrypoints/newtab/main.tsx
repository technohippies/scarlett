import { render } from 'solid-js/web';
import { Component, createSignal, onMount, For } from 'solid-js';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type {
    GetDueItemsRequest,
    GetDueItemsResponse,
    SubmitReviewRequest,
    SubmitReviewResponse
} from '../../src/shared/messaging-types';
import type { DueLearningItem } from '../../src/services/srs/types';
import { Grade, Rating } from 'ts-fsrs';

// Define the protocol map for messages SENT TO the background
interface BackgroundProtocol {
    getDueItems(data: GetDueItemsRequest): Promise<GetDueItemsResponse>;
    submitReviewResult(data: SubmitReviewRequest): Promise<SubmitReviewResponse>;
}

// Initialize messaging client
const messaging = defineExtensionMessaging<BackgroundProtocol>();

const NewTabPage: Component = () => {
  const [dueItems, setDueItems] = createSignal<DueLearningItem[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const fetchDueItems = async () => {
    console.log('[NewTab] Fetching due items...');
    setIsLoading(true);
    setError(null);
    try {
        const response = await messaging.sendMessage('getDueItems', { limit: 10 });
        console.log('[NewTab] Received due items:', response.dueItems);
        setDueItems(response.dueItems);
    } catch (err: any) {
        console.error('[NewTab] Error fetching due items:', err);
        setError(err.message || 'Failed to fetch due items.');
    } finally {
        setIsLoading(false);
    }
  };

  onMount(fetchDueItems);

  const submitTestReview = async (learningId: number, grade: Grade) => {
      console.log(`[NewTab] Submitting test review for ${learningId} with grade ${grade}`);
      const currentItems = dueItems();
      setDueItems(currentItems.filter(item => item.learningId !== learningId));

      try {
          const response = await messaging.sendMessage('submitReviewResult', {
              learningId,
              grade
          });
          console.log('[NewTab] Submit review response:', response);
          if (!response.success) {
               alert(`Failed to submit review: ${response.error}`);
               setDueItems(currentItems); // Revert
          }
      } catch (err: any) {
           console.error('[NewTab] Error submitting review:', err);
           alert(`Error submitting review: ${err.message}`);
           setDueItems(currentItems); // Revert
      }
  }

  return (
    <div style={{ padding: '2rem', 'font-family': 'sans-serif' }}>
      <h1>Scarlett Study</h1>
      <button onClick={fetchDueItems} disabled={isLoading()}>
        {isLoading() ? 'Refreshing...' : 'Refresh Due Items'}
      </button>

      {isLoading() && !dueItems().length && <p>Loading...</p>}
      {error() && <p style={{ color: 'red' }}>Error: {error()}</p>}

      <h2>Due Items ({dueItems().length})</h2>
      <ul style={{ 'list-style': 'none', padding: 0 }}>
        <For each={dueItems()} fallback={<p>{!isLoading() && !error() ? 'No items due for review.' : ''}</p>}>
          {(item) => (
            <li style={{
                border: '1px solid #ccc',
                'margin-bottom': '0.5rem',
                padding: '0.5rem',
                display: 'flex',
                'justify-content': 'space-between',
                'align-items': 'center'
            }}>
              <span>{item.sourceText} -&gt; {item.targetText} (ID: {item.learningId})</span>
              <div>
                <button style={{ 'margin-left': '0.5rem' }} title="Grade 1: Again" onClick={() => submitTestReview(item.learningId, Rating.Again as Grade)}>Again</button>
                <button style={{ 'margin-left': '0.5rem' }} title="Grade 2: Hard" onClick={() => submitTestReview(item.learningId, Rating.Hard as Grade)}>Hard</button>
                <button style={{ 'margin-left': '0.5rem' }} title="Grade 3: Good" onClick={() => submitTestReview(item.learningId, Rating.Good as Grade)}>Good</button>
                <button style={{ 'margin-left': '0.5rem' }} title="Grade 4: Easy" onClick={() => submitTestReview(item.learningId, Rating.Easy as Grade)}>Easy</button>
              </div>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
};

// Render the component
render(() => <NewTabPage />, document.getElementById('root')!); 