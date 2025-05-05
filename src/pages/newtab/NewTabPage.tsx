import { Component, createResource, createSignal } from 'solid-js';
// import { messaging } from '#imports'; // Remove incorrect import
import { defineExtensionMessaging } from '@webext-core/messaging'; // Import the core function
import NewTabPageView from './NewTabPageView';
import type { StudySummary } from '../../services/srs/types'; // Use StudySummary type
import type { BackgroundProtocolMap } from '../../background/handlers/message-handlers'; // Import the protocol map

// Initialize messaging specifically for this page, typed with the background protocol
const messaging = defineExtensionMessaging<BackgroundProtocolMap>();

// Props definition
interface NewTabPageProps {
  onNavigateToBookmarks: () => void;
  onNavigateToStudy: () => void;
  onNavigateToSettings: () => void;
}

const NewTabPage: Component<NewTabPageProps> = (props) => {
  console.log('[NewTabPage] Component rendering');

  // Resource for fetching study summary
  const [summaryData] = createResource<StudySummary | null>(async () => {
    console.log('[NewTabPage] Fetching study summary...');
    try {
      const summary = await messaging.sendMessage('getStudySummary', {});
      console.log('[NewTabPage] Received study summary:', summary);
      // Ensure counts are numbers before returning
      return {
          dueCount: Number(summary?.dueCount || 0),
          reviewCount: Number(summary?.reviewCount || 0),
          newCount: Number(summary?.newCount || 0)
      };
    } catch (error) {
      console.error('[NewTabPage] Error fetching study summary:', error);
      return null;
    }
  }, { initialValue: { dueCount: 0, reviewCount: 0, newCount: 0 } }); // Provide initial structure

  // --- State for Manual Embedding ---
  const [embeddingCountData, { refetch: refetchEmbeddingCount }] = createResource<{ count: number }>(async () => {
    console.log('[NewTabPage] Fetching pending embedding count...');
    try {
      const result = await messaging.sendMessage('getPendingEmbeddingCount', undefined);
      console.log('[NewTabPage] Received pending count:', result);
      return result || { count: 0 };
    } catch (error) {
      console.error('[NewTabPage] Error fetching pending embedding count:', error);
      return { count: 0 };
    }
  }, { initialValue: { count: 0 } });

  const [isEmbedding, setIsEmbedding] = createSignal(false);
  const [embedStatusMessage, setEmbedStatusMessage] = createSignal<string | null>(null);

  const handleEmbedClick = async () => {
    console.log('[NewTabPage] handleEmbedClick triggered.');
    setIsEmbedding(true);
    setEmbedStatusMessage('Starting embedding process...');
    try {
      const result = await messaging.sendMessage('triggerBatchEmbedding', undefined);
      if (result.success) {
        console.log('[NewTabPage] Batch embedding successful:', result);
        setEmbedStatusMessage(`Successfully embedded ${result.processedCount || 0} pages.`);
        refetchEmbeddingCount(); // Refresh the count after processing
      } else {
        console.error('[NewTabPage] Batch embedding failed:', result.error);
        setEmbedStatusMessage(`Error: ${result.error || 'Embedding failed.'}`);
      }
    } catch (error: any) {
      console.error('[NewTabPage] Error sending triggerBatchEmbedding message:', error);
      setEmbedStatusMessage(`Error: ${error.message || 'Could not trigger embedding.'}`);
    } finally {
      setIsEmbedding(false);
      // Optionally clear the status message after a delay
      setTimeout(() => setEmbedStatusMessage(null), 5000); 
    }
  };
  // --- End State for Manual Embedding ---

  return (
    <NewTabPageView 
      summary={summaryData} // Pass the resource accessor
      summaryLoading={() => summaryData.loading} // Wrap loading state in an accessor
      pendingEmbeddingCount={() => embeddingCountData()?.count ?? 0} // Accessor for count
      isEmbedding={isEmbedding} // Pass embedding status signal accessor
      embedStatusMessage={embedStatusMessage} // Pass status message signal accessor
      onEmbedClick={handleEmbedClick} // Pass the handler
      onNavigateToBookmarks={props.onNavigateToBookmarks}
      onNavigateToStudy={props.onNavigateToStudy}
      onNavigateToSettings={props.onNavigateToSettings}
    />
  );
};

export default NewTabPage;