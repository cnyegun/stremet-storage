import type { ActionProposal } from '@shared/types';
type MultimodalContent = Array<{
    type: 'text';
    text: string;
} | {
    type: 'image_url';
    image_url: {
        url: string;
        detail?: string;
    };
}>;
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | MultimodalContent;
}
interface AssistantResult {
    message: string;
    sql?: string;
    data?: Record<string, unknown>[];
    rowCount?: number;
    action?: ActionProposal;
}
export declare function handleAssistantMessage(message: string, history: ChatMessage[], imageBase64?: string): Promise<AssistantResult>;
export {};
