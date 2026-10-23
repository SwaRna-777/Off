import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { createChatGPTBridge } from './chatgpt-bridge.js';
import './index.css';

const host = createChatGPTBridge();
function ChatGPTEditor() {
  const [connection, setConnection] = useState({ state: 'idle', error: '' });
  React.useEffect(() => {
    const unsubscribe = host.subscribeStatus(setConnection);
    host.connect().catch(() => {});
    return () => { unsubscribe(); host.disconnect(); };
  }, []);
  return <>
    {connection.state === 'connecting' && <div role="status" className="status-area no-print">Connecting to ChatGPT…</div>}
    {connection.error && <div role="alert" className="error-banner no-print"><p>{connection.error}</p>{connection.state === 'disconnected' && <button type="button" onClick={() => host.connect().catch(() => {})}>Retry connection</button>}</div>}
    <App host={host} />
  </>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<ChatGPTEditor />);
if (import.meta.hot) import.meta.hot.dispose(() => host.disconnect());
