import { App as McpApp } from '@modelcontextprotocol/ext-apps';
import { resumeSchema } from './resume-schema.js';

const connectionOptions = { timeout: 15000, maxTotalTimeout: 15000 };
const requestOptions = { timeout: 30000, maxTotalTimeout: 30000 };
const connectionMessage = 'Could not connect to ChatGPT. Retry the connection or reopen the editor from the Folio tool in your conversation.';

function matchesSchema(value, schema) {
  if (schema.type === 'string') return typeof value === 'string' && value.length <= 150000;
  if (schema.type === 'integer') return Number.isInteger(value) && value >= schema.minimum && value <= schema.maximum;
  if (schema.type === 'array') return Array.isArray(value) && value.length <= 200 && value.every((entry) => matchesSchema(entry, schema.items));
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && schema.required.every((key) => Object.hasOwn(value, key) && matchesSchema(value[key], schema.properties[key]))
    && Object.entries(schema.properties).every(([key, property]) => value[key] === undefined || matchesSchema(value[key], property));
}

function validPayload(payload) {
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload)
    && (payload.resume_text === undefined || typeof payload.resume_text === 'string' && payload.resume_text.length <= 150000)
    && (payload.jd_text === undefined || typeof payload.jd_text === 'string' && payload.jd_text.length <= 100000)
    && (payload.format === undefined || ['international', 'german'].includes(payload.format))
    && (payload.request_id === undefined || typeof payload.request_id === 'string' && payload.request_id.length <= 100)
    && (payload.resume === undefined || matchesSchema(payload.resume, resumeSchema))
    && JSON.stringify(payload).length <= 1000000;
}

export function createChatGPTBridge() {
  const listeners = new Set();
  const statusListeners = new Set();
  let latest;
  let connection;
  let client;
  let stopResize;
  let generation = 0;
  let status = { state: 'idle', error: '' };
  function updateStatus(state, error = '') {
    status = { state, error };
    for (const listener of [...statusListeners]) {
      if (statusListeners.has(listener)) listener(status);
    }
  }
  function deliver(listener, payload) {
    try { listener(structuredClone(payload)); }
    catch { updateStatus(status.state, 'This resume update could not be opened. Ask ChatGPT to call present_resume with a complete resume. Your existing edits are preserved.'); }
  }
  function connect() {
    if (connection) return connection;
    const attempt = ++generation;
    const candidate = new McpApp({ name: 'Folio Resume Studio', version: '1.0.0' }, { availableDisplayModes: ['inline', 'fullscreen'] }, { autoResize: false });
    client = candidate;
    updateStatus('connecting');
    candidate.onclose = () => {
      if (attempt !== generation) return;
      stopResize?.(); stopResize = undefined;
      connection = undefined; client = undefined;
      updateStatus('disconnected', 'The ChatGPT connection was closed. Retry the connection or reopen this editor. Your current edits remain available.');
    };
    candidate.onerror = () => {
      if (attempt === generation) updateStatus(status.state, 'ChatGPT sent an unreadable message. Your current edits are preserved; retry the action.');
    };
    candidate.ontoolresult = (result) => {
      if (attempt !== generation || client !== candidate) return;
      try {
        if (!result || result.isError || !validPayload(result.structuredContent)) throw new Error('Invalid resume update');
        latest = structuredClone(result.structuredContent);
        updateStatus(status.state);
        for (const listener of [...listeners]) if (listeners.has(listener)) deliver(listener, latest);
      } catch {
        updateStatus(status.state, 'ChatGPT returned an incomplete or invalid resume update. Ask it to call present_resume with every required field. Your existing edits are preserved.');
      }
    };
    connection = Promise.resolve().then(() => candidate.connect(undefined, connectionOptions)).then(() => {
      if (attempt !== generation || client !== candidate) throw new Error(connectionMessage);
      stopResize = candidate.setupSizeChangedNotifications();
      updateStatus('connected');
    }).catch(async () => {
      if (attempt === generation) {
        stopResize?.(); stopResize = undefined;
        client = undefined; connection = undefined;
        updateStatus('disconnected', connectionMessage);
      }
      await candidate.close().catch(() => {});
      throw new Error(connectionMessage);
    });
    return connection;
  }
  async function connectedClient() {
    await connect();
    if (!client || status.state !== 'connected') throw new Error(connectionMessage);
    return client;
  }
  return {
    connect,
    disconnect() {
      generation += 1;
      stopResize?.(); stopResize = undefined;
      const previous = client;
      client = undefined; connection = undefined; latest = undefined;
      listeners.clear(); statusListeners.clear();
      status = { state: 'idle', error: '' };
      return previous ? previous.close().catch(() => {}) : Promise.resolve();
    },
    subscribeStatus(listener) {
      statusListeners.add(listener);
      listener(status);
      return () => statusListeners.delete(listener);
    },
    subscribe(listener) {
      listeners.add(listener);
      if (latest) deliver(listener, latest);
      return () => listeners.delete(listener);
    },
    async ask(text) {
      const active = await connectedClient();
      if (!active.getHostCapabilities()?.message?.text) throw new Error('This ChatGPT host cannot receive text requests from the editor. Ask ChatGPT to refine your resume directly in the conversation.');
      const result = await active.sendMessage({ role: 'user', content: [{ type: 'text', text }] }, requestOptions);
      if (result.isError) throw new Error('ChatGPT declined this request. You can ask it to refine the resume in the conversation.');
    },
    async download(blob, name) {
      const active = await connectedClient();
      if (!active.getHostCapabilities()?.downloadFile) throw new Error('This ChatGPT host does not support file downloads. Open the standalone app for exports.');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
      const result = await active.downloadFile({ contents: [{ type: 'resource', resource: { uri: `file:///${encodeURIComponent(name)}`, mimeType: blob.type || 'application/octet-stream', blob: btoa(binary) } }] }, requestOptions);
      if (result.isError) throw new Error('The download was declined or cancelled.');
    },
    async expand() {
      const active = await connectedClient();
      if (!active.getHostContext()?.availableDisplayModes?.includes('fullscreen')) throw new Error('Fullscreen is not available in this ChatGPT host. Continue editing in the current view.');
      const result = await active.requestDisplayMode({ mode: 'fullscreen' }, requestOptions);
      if (result.mode !== 'fullscreen') throw new Error('ChatGPT kept the editor in its current view. You can continue editing here.');
    },
  };
}
