import { useEffect, useRef, useState } from 'react';

export default function SocketConnect() {
  const socketRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);

  const connectSocket = () => {
    setError(null);
    setConnectionStatus('Connecting...');
    
    try {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        setError('Connection already established');
        return;
      }

      socketRef.current = new WebSocket('ws://localhost:8000/ws/socket-server/');

      socketRef.current.onopen = () => {
        setConnectionStatus('Connected');
        addMessage('connection', 'WebSocket connected successfully');
      };

      socketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addMessage('message', data);
        } catch (parseError) {
          addMessage('error', `Failed to parse message: ${parseError.message}`);
        }
      };

      socketRef.current.onerror = (errorEvent) => {
        const error = {
          type: 'WebSocket Error',
          message: errorEvent.message || 'Unknown error occurred',
          timestamp: new Date().toISOString(),
        };
        setError(error);
        addMessage('error', error);
        setConnectionStatus('Disconnected');
      };

      socketRef.current.onclose = (closeEvent) => {
        addMessage('connection', `Disconnected (Code: ${closeEvent.code}, Reason: ${closeEvent.reason || 'none'})`);
        setConnectionStatus('Disconnected');
      };

    } catch (err) {
      const error = {
        type: 'Connection Error',
        message: err.message,
        timestamp: new Date().toISOString(),
      };
      setError(error);
      addMessage('error', error);
      setConnectionStatus('Disconnected');
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

  const sendMessage = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const message = { message: 'Hello from React!' };
      socketRef.current.send(JSON.stringify(message));
      addMessage('sent', message);
    } else {
      const error = {
        type: 'Send Error',
        message: 'Cannot send message - connection not established',
        timestamp: new Date().toISOString()
      };
      setError(error);
      addMessage('error', error);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <button 
          onClick={connectSocket}
          disabled={connectionStatus === 'Connected'}
          style={{ marginRight: '1rem' }}
        >
          {connectionStatus === 'Connected' ? 'Connected' : 'Connect to WebSocket'}
        </button>
        
        <button 
          onClick={sendMessage}
          disabled={connectionStatus !== 'Connected'}
        >
          Send Message
        </button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        Status: {connectionStatus}
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>
          Last Error: {JSON.stringify(error, null, 2)}
        </div>
      )}

      <div>
        <h4>WebSocket Events:</h4>
        <pre style={{
          backgroundColor: '#f5f5f5',
          padding: '1rem',
          borderRadius: '4px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {JSON.stringify(messages, null, 2)}
        </pre>
      </div>
    </div>
  );
}