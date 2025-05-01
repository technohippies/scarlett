import { SetupModels } from '../../../src/features/oninstall/SetupModels';
import messagesEn from '../../../public/_locales/en/messages.json';

export default {
  title: 'Features/OnInstall/SetupModels',
  component: SetupModels,
  parameters: {
    layout: 'fullscreen', // Use fullscreen layout like other steps
  },
  tags: ['autodocs'],
  args: {
    onComplete: (models: { embeddingModelId: string; readerModelId: string }) => {
        console.log('Story: SetupModels onComplete triggered with:', models);
    },
    onBack: () => console.log('Story: SetupModels onBack triggered'),
    messages: messagesEn,
  },
};

// Basic render story
export const Default = {
    render: (args: any) => (
        <div class="h-screen w-full">
            <SetupModels {...args} />
        </div>
    ),
}; 