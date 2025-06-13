// src/utils/recorderParsing.js
// Helper to parse a recorder entry from results.recorders
export function parseRecorder(recorder) {
  // recorder.columns: array of strings
  // recorder.data: array of lines, each a string "val1 val2 …"
  if (!recorder || !recorder.columns || !recorder.data || recorder.data.length === 0) {
    return null;
  }
  // Take last row
  const lastLine = recorder.data[recorder.data.length - 1].trim();
  const tokens = lastLine.split(/\s+/);
  // Parse floats; if NaN, set null
  const values = tokens.map(tok => {
    const num = parseFloat(tok);
    return isNaN(num) ? null : num;
  });
  // Return columns and values array aligned by index
  return {
    columns: recorder.columns,
    values,
  };
}
