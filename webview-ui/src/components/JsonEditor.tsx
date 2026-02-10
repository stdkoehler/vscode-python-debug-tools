// src/components/JsonEditor.tsx
import React from "react";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}

const JsonEditor: React.FC<JsonEditorProps> = ({ value, onChange, error }) => {
  return (
    <div className="editor-wrapper">
      <textarea
        value={value ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        spellCheck="false"
      />
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default JsonEditor;
