// SocketConnect.jsx

import React, { useRef, useState, useEffect } from 'react';
import { useDataCentre } from './DataHandler/DataCentreTruss2D';
import './SocketConnect.css';

export default function SocketConnect() {
  const socketRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [receivedFile, setReceivedFile] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const { data } = useDataCentre(); // JSON model from context

  // Automatically close socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close(1000, 'Component unmounted');
      }
    };
  }, []);

  // 1. Connect to WebSocket
  const connectSocket = () => {
    setError(null);
    setConnectionStatus('Connecting...');
    console.log("🔌 Attempting to connect to WebSocket…");

    try {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        console.warn("⚠ WebSocket already open");
        setError({
          type: 'Connection Warning',
          message: 'Connection already established',
          timestamp: new Date().toISOString()
        });
        setConnectionStatus('Connected');
        return;
      }

      const ws = new WebSocket('ws://localhost:8000/ws/socket-server/');
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("🔗 WebSocket connected!");
        setConnectionStatus('Connected');
        addMessage('connection', { message: 'WebSocket connected successfully' });
      };

      ws.onmessage = (event) => {
        console.log("⬅ Raw WS event.data:", event.data);
        try {
          const incoming = JSON.parse(event.data);
          console.log("⬅ Parsed WS message:", incoming);
          addMessage('message', incoming);

          // 2. If we get type==="file", store it so that user can download
          if (incoming.type === 'file' && incoming.content) {
            const { filename, filedata } = incoming.content;
            if (filename && filedata != null) {
              setReceivedFile({ filename, filedata });
              console.log(`✅ Stored file: ${filename}`);
            }
          }
        } catch (parseError) {
          console.error("Failed to parse WS message:", parseError);
          addMessage('error', {
            type: 'Parse Error',
            message: parseError.message,
            timestamp: new Date().toISOString()
          });
        }
      };

      ws.onerror = (errorEvent) => {
        console.error("⚠ WebSocket encountered an error:", errorEvent);
        const errorObj = {
          type: 'WebSocket Error',
          message: errorEvent.message || 'Unknown error occurred',
          timestamp: new Date().toISOString()
        };
        setError(errorObj);
        addMessage('error', errorObj);
        setConnectionStatus('Disconnected');
      };

      ws.onclose = (closeEvent) => {
        console.log(`🔒 WebSocket closed. Code: ${closeEvent.code}, Reason: ${closeEvent.reason}`);
        addMessage('connection', {
          message: `Disconnected (Code: ${closeEvent.code}, Reason: ${closeEvent.reason || 'none'})`
        });
        setConnectionStatus('Disconnected');
      };
    } catch (err) {
      console.error("⚠ Connection Error:", err);
      const errorObj = {
        type: 'Connection Error',
        message: err.message,
        timestamp: new Date().toISOString()
      };
      setError(errorObj);
      addMessage('error', errorObj);
      setConnectionStatus('Disconnected');
    }
  };

  // 3. Send a simple text message (for testing)
  const sendMessage = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const messageObj = {
        type: 'message',
        content: 'Hello from React!'
      };
      console.log("➡ Sending message → backend:", messageObj);
      socketRef.current.send(JSON.stringify(messageObj));
      addMessage('sent', messageObj);
    } else {
      const errorObj = {
        type: 'Send Error',
        message: 'Cannot send message – connection not established',
        timestamp: new Date().toISOString()
      };
      setError(errorObj);
      addMessage('error', errorObj);
    }
  };

  // 4. Send the JSON model to the backend
  const sendJsonFile = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      try {
        const message = {
          type: 'file',
          content: data,
          timestamp: new Date().toISOString()
        };
        console.log("➡ Sending JSON → backend:", message);
        socketRef.current.send(JSON.stringify(message));
        addMessage('sent', message);

        // Clear any previously‐received file, so the button resets
        setReceivedFile(null);
      } catch (err) {
        const errorObj = {
          type: 'JSON Error',
          message: `Failed to stringify JSON: ${err.message}`,
          timestamp: new Date().toISOString()
        };
        setError(errorObj);
        addMessage('error', errorObj);
      }
    } else {
      const errorObj = {
        type: 'Send Error',
        message: 'Cannot send file – connection not established',
        timestamp: new Date().toISOString()
      };
      setError(errorObj);
      addMessage('error', errorObj);
    }
  };

  // 5. Download the received Python file
  const downloadFile = () => {
    if (!receivedFile || downloading) return;
    setDownloading(true);

    const { filename, filedata } = receivedFile;
    try {
      const blob = new Blob([filedata], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      console.log(`✅ Download triggered for ${filename}`);
    } catch (err) {
      console.error("⚠ Download Error:", err);
      addMessage('error', {
        type: 'Download Error',
        message: err.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setDownloading(false);
    }
  };

  const addMessage = (type, data) => {
    setMessages(prev => [
      ...prev,
      {
        type,
        data,
        timestamp: new Date().toISOString()
      }
    ]);
  };

  return (
    <div className="socket-container">
      <div className="button-group">
        <button
          onClick={connectSocket}
          disabled={connectionStatus === 'Connected' || connectionStatus === 'Connecting...'}
        >
          {connectionStatus === 'Connected' ? 'Connected' :
           connectionStatus === 'Connecting...' ? 'Connecting…' :
           'Connect to WebSocket'}
        </button>

        <button
          onClick={sendMessage}
          disabled={connectionStatus !== 'Connected'}
        >
          Send Message
        </button>

        <button
          onClick={sendJsonFile}
          disabled={connectionStatus !== 'Connected'}
        >
          Send JSON File
        </button>
      </div>
      {/* 6. Show “Download Generated Python Script” button; style changes based on receivedFile */}
      <div style={{ marginTop: '1rem' }}>
        <button
          className={`download-button ${
            receivedFile && !downloading
              ? 'download-button--active'
              : 'download-button--inactive'
          }`}
          onClick={downloadFile}
          disabled={!receivedFile || downloading}
        >
          {downloading
            ? 'Downloading…'
            : receivedFile
            ? `Download: ${receivedFile.filename}`
            : 'Waiting for file…'}
        </button>
      </div>
      <div className="status-line">
        <strong>Status:</strong> {connectionStatus}
      </div>

      {error && (
        <div className="error-block">
          <strong>Last Error:</strong>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      )}



      <div className="events-header">WebSocket Events:</div>
      <pre className="events-log">
        {JSON.stringify(messages, null, 2)}
      </pre>
    </div>
  );
}
