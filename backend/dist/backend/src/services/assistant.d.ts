interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}
interface AssistantResult {
    message: string;
    sql?: string;
    data?: Record<string, unknown>[];
    rowCount?: number;
}
export declare function handleAssistantMessage(message: string, history: ChatMessage[]): Promise<AssistantResult>;
export {};
