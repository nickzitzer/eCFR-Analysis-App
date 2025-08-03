import React from 'react';

interface AiAssistantProps {
  regulationId: string;
}

const AiAssistant: React.FC<AiAssistantProps> = ({ regulationId }) => {
  return (
    <div className="ai-assistant">
      <h2>AI Assistant for Regulation: {regulationId}</h2>
      {/* Placeholder for chat interface */}
      <p>Chat interface for AI assistant will be here.</p>
    </div>
  );
};

export default AiAssistant;
