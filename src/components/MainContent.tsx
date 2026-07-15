import React from "react";
import { Clock } from "lucide-react";
import { ChatSession, ModelInfo, ProviderInfo, FileMetadata, CustomProvider } from "../types";
import ChatHub from "./ChatHub";
import CodeWorkspace from "./CodeWorkspace";
import DataAnalyzer from "./DataAnalyzer";
import MediaHub from "./MediaHub";
import MemoryManager from "./MemoryManager";

interface MainContentProps {
  activePanel: string;
  session: ChatSession;
  models: ModelInfo[];
  providers: ProviderInfo[];
  isSending: boolean;
  routingMode: "manuel" | "parallel" | "best_match";
  onChangeRoutingMode: (mode: "manuel" | "parallel" | "best_match") => void;
  systemInstruction: string;
  onUpdateSystemInstruction: (val: string) => void;
  files: FileMetadata[];
  onUploadFile: (name: string, size: number, content: string) => Promise<void>;
  onRemoveFile: (id: string) => void;
  onQueryFileContent: (query: string, fileContents: string) => Promise<string>;
  onDeepResearch: (topic: string) => Promise<any>;
  onGenerateImage: (prompt: string) => Promise<any>;
  onSynthesizeSpeech: (text: string) => Promise<any>;
  onSendMessage: (text: string, routingMode: string, customSystemInstruction: string, aiMode: "fast" | "balanced" | "deep" | "agent" | "swarm", isContinue?: boolean, effortLevel?: "low" | "medium" | "high" | "max", behaviorMode?: "normal" | "assistant" | "expert" | "architect", selectedModelId?: string) => void;
  onAbort?: () => void;
  onSelectModel?: (modelId: string) => void;
  onNewChat: () => void;
  onClearHistory: () => void;
  onToggleHistory: () => void;
  onToggleDiagnostics?: () => void;
  freeOnly?: boolean;
  customProviders?: CustomProvider[];
  onActivateCustomProvider?: (id: string) => void;
}

export default function MainContent({
  activePanel,
  session,
  models,
  providers,
  isSending,
  routingMode,
  onChangeRoutingMode,
  systemInstruction,
  onUpdateSystemInstruction,
  files,
  onUploadFile,
  onRemoveFile,
  onQueryFileContent,
  onDeepResearch,
  onGenerateImage,
  onSynthesizeSpeech,
  onSendMessage,
  onAbort,
  onSelectModel,
  onNewChat,
  onClearHistory,
  onToggleHistory,
  onToggleDiagnostics,
  freeOnly,
  customProviders,
  onActivateCustomProvider,
}: MainContentProps) {
  switch (activePanel) {
    case "chat":
      return (
        <ChatHub
          messages={session.messages}
          models={models}
          providers={providers}
          activeModelIds={session.activeModelIds}
          onSendMessage={onSendMessage}
          onAbort={onAbort}
          onSelectModel={onSelectModel}
          isSending={isSending}
          routingMode={routingMode}
          onChangeRoutingMode={onChangeRoutingMode}
          systemInstruction={systemInstruction}
          onUpdateSystemInstruction={onUpdateSystemInstruction}
          onNewChat={onNewChat}
          onClearHistory={onClearHistory}
          onToggleHistory={onToggleHistory}
          onToggleDiagnostics={onToggleDiagnostics}
          files={files}
          onUploadFile={onUploadFile}
          onRemoveFile={onRemoveFile}
          onQueryFileContent={onQueryFileContent}
          onDeepResearch={onDeepResearch}
          onGenerateImage={onGenerateImage}
          onSynthesizeSpeech={onSynthesizeSpeech}
          freeOnly={freeOnly}
          customProviders={customProviders}
          onActivateCustomProvider={onActivateCustomProvider}
        />
      );

    case "code":
      return (
        <CodeWorkspace />
      );

    case "data":
      return (
        <DataAnalyzer
          files={files}
          onUploadFile={onUploadFile}
          onRemoveFile={onRemoveFile}
          onQueryFileContent={onQueryFileContent}
        />
      );

    case "media":
      return (
        <MediaHub
          onGenerateImage={onGenerateImage}
          onSynthesizeSpeech={onSynthesizeSpeech}
        />
      );

    case "memory":
      return <MemoryManager />;

    default:
      return (
        <div className="flex-1 flex items-center justify-center text-gray-500 font-sans">
          Bilinmeyen panel seçildi.
        </div>
      );
  }
}
