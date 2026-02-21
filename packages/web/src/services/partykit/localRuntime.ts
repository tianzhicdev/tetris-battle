import GameRoomServer from '@tetris-battle/partykit/src/game';
import DefenseLineServer from '@tetris-battle/partykit/src/defense-line-server';

type PartyName = 'game' | 'defenseline';
type LocalSocketEventType = 'open' | 'message' | 'close' | 'error';
type OpenCloseErrorListener = (event: Event) => void;
type MessageListener = (event: MessageEvent<string>) => void;

const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;
const SOCKET_CLOSED = 3;

interface LocalServerConnection {
  id: string;
  send(message: string): void;
}

interface LocalPartyRoomApi {
  id: string;
  getConnections(): IterableIterator<LocalServerConnection>;
  broadcast(message: string, withoutIds?: string[]): void;
}

interface LocalPartyServer {
  onConnect(conn: LocalServerConnection, ctx?: unknown): void;
  onMessage(message: string, sender: LocalServerConnection): void;
  onClose(conn: LocalServerConnection): void;
}

export interface PartySocketLike {
  readyState: number;
  addEventListener(type: 'message', listener: MessageListener): void;
  addEventListener(type: 'open' | 'close' | 'error', listener: OpenCloseErrorListener): void;
  removeEventListener(type: 'message', listener: MessageListener): void;
  removeEventListener(type: 'open' | 'close' | 'error', listener: OpenCloseErrorListener): void;
  send(data: string): void;
  close(): void;
}

class LocalPartySocket implements PartySocketLike {
  readonly id: string;
  private readonly runtime: LocalRoomRuntime;
  readyState = SOCKET_CONNECTING;
  private readonly listeners: Record<LocalSocketEventType, Set<(event: Event | MessageEvent<string>) => void>> = {
    open: new Set(),
    message: new Set(),
    close: new Set(),
    error: new Set(),
  };

  constructor(id: string, runtime: LocalRoomRuntime) {
    this.id = id;
    this.runtime = runtime;
  }

  addEventListener(type: 'message', listener: MessageListener): void;
  addEventListener(type: 'open' | 'close' | 'error', listener: OpenCloseErrorListener): void;
  addEventListener(type: LocalSocketEventType, listener: ((event: any) => void)): void {
    this.listeners[type].add(listener);
  }

  removeEventListener(type: 'message', listener: MessageListener): void;
  removeEventListener(type: 'open' | 'close' | 'error', listener: OpenCloseErrorListener): void;
  removeEventListener(type: LocalSocketEventType, listener: ((event: any) => void)): void {
    this.listeners[type].delete(listener);
  }

  send(data: string): void {
    if (this.readyState !== SOCKET_OPEN) return;
    this.runtime.receiveFromClient(this.id, data);
  }

  close(): void {
    if (this.readyState === SOCKET_CLOSED) return;
    this.notifyClose();
    this.runtime.disconnectSocket(this.id);
  }

  isClosed(): boolean {
    return this.readyState === SOCKET_CLOSED;
  }

  notifyOpen(): void {
    if (this.readyState === SOCKET_CLOSED) return;
    this.readyState = SOCKET_OPEN;
    this.dispatch('open', new Event('open'));
  }

  notifyMessage(message: string): void {
    if (this.readyState !== SOCKET_OPEN) return;
    this.dispatch('message', new MessageEvent<string>('message', { data: message }));
  }

  notifyError(): void {
    if (this.readyState === SOCKET_CLOSED) return;
    this.dispatch('error', new Event('error'));
  }

  notifyClose(): void {
    if (this.readyState === SOCKET_CLOSED) return;
    this.readyState = SOCKET_CLOSED;
    this.dispatch('close', new Event('close'));
  }

  private dispatch(type: LocalSocketEventType, event: Event | MessageEvent<string>): void {
    for (const listener of this.listeners[type]) {
      listener(event);
    }
  }
}

class LocalRoomRuntime {
  readonly key: string;
  readonly party: PartyName;
  readonly roomId: string;
  private readonly onEmpty: (key: string) => void;
  private readonly connections = new Map<string, LocalServerConnection>();
  private readonly sockets = new Map<string, LocalPartySocket>();
  private readonly roomApi: LocalPartyRoomApi;
  private readonly server: LocalPartyServer;

  constructor(
    key: string,
    party: PartyName,
    roomId: string,
    onEmpty: (key: string) => void,
  ) {
    this.key = key;
    this.party = party;
    this.roomId = roomId;
    this.onEmpty = onEmpty;
    this.roomApi = {
      id: roomId,
      getConnections: () => this.connections.values(),
      broadcast: (message: string, withoutIds: string[] = []) => {
        const ignored = new Set(withoutIds);
        for (const connection of this.connections.values()) {
          if (ignored.has(connection.id)) continue;
          connection.send(message);
        }
      },
    };
    this.server = this.createServer();
  }

  createSocket(connectionId: string): LocalPartySocket {
    const socket = new LocalPartySocket(connectionId, this);
    queueMicrotask(() => this.attachSocket(socket));
    return socket;
  }

  receiveFromClient(connectionId: string, message: string): void {
    const connection = this.connections.get(connectionId);
    const socket = this.sockets.get(connectionId);
    if (!connection || !socket) return;

    try {
      this.server.onMessage(message, connection);
    } catch (error) {
      console.error('[LOCAL-RUNTIME] server onMessage failed', error);
      socket.notifyError();
    }
  }

  disconnectSocket(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    const socket = this.sockets.get(connectionId);

    if (connection) {
      this.connections.delete(connectionId);
    }
    if (socket) {
      this.sockets.delete(connectionId);
    }

    if (connection) {
      try {
        this.server.onClose(connection);
      } catch (error) {
        console.error('[LOCAL-RUNTIME] server onClose failed', error);
      }
    }

    if (socket) {
      socket.notifyClose();
    }

    if (this.connections.size === 0) {
      this.onEmpty(this.key);
    }
  }

  private attachSocket(socket: LocalPartySocket): void {
    if (socket.isClosed()) return;

    const connection: LocalServerConnection = {
      id: socket.id,
      send: (message: string) => {
        socket.notifyMessage(message);
      },
    };

    this.connections.set(connection.id, connection);
    this.sockets.set(connection.id, socket);
    socket.notifyOpen();
    if (socket.isClosed()) return;

    try {
      this.server.onConnect(connection, {});
    } catch (error) {
      console.error('[LOCAL-RUNTIME] server onConnect failed', error);
      socket.notifyError();
      this.disconnectSocket(connection.id);
    }
  }

  private createServer(): LocalPartyServer {
    if (this.party === 'game') {
      return new GameRoomServer(this.roomApi as any);
    }
    return new DefenseLineServer(this.roomApi as any);
  }
}

class LocalPartyRuntime {
  private static instance: LocalPartyRuntime | null = null;
  private readonly rooms = new Map<string, LocalRoomRuntime>();
  private nextConnectionId = 1;

  static getInstance(): LocalPartyRuntime {
    if (!LocalPartyRuntime.instance) {
      LocalPartyRuntime.instance = new LocalPartyRuntime();
    }
    return LocalPartyRuntime.instance;
  }

  createSocket(party: PartyName, roomId: string): PartySocketLike {
    const key = `${party}:${roomId}`;
    let room = this.rooms.get(key);
    if (!room) {
      room = new LocalRoomRuntime(key, party, roomId, (emptyKey) => {
        this.rooms.delete(emptyKey);
      });
      this.rooms.set(key, room);
    }

    const connectionId = `local_conn_${this.nextConnectionId++}`;
    return room.createSocket(connectionId);
  }
}

export function createLocalPartySocket(party: PartyName, roomId: string): PartySocketLike {
  return LocalPartyRuntime.getInstance().createSocket(party, roomId);
}
