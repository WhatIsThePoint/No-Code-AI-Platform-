import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../store/authSlice";

/**
 * Lazily-constructed SocketIO client for pipeline chat + meeting events.
 *
 * The connection authenticates via the auth handshake payload so the
 * gateway can reject non-company-tier users and load their membership
 * before any room work happens.
 *
 * In dev, vite.config.ts proxies both `/api` and `/socket.io` to the
 * gateway on :8000. In prod, same-origin routing is assumed.
 */

let _socket: Socket | null = null;
let _tokenSubscribed = false;

export function getSocket(): Socket {
  if (_socket) return _socket;

  const token = useAuthStore.getState().accessToken ?? "";
  _socket = io({
    path: "/socket.io",
    transports: ["websocket", "polling"],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  if (!_tokenSubscribed) {
    _tokenSubscribed = true;
    let lastToken = token;
    useAuthStore.subscribe((state) => {
      if (state.accessToken !== lastToken && _socket) {
        lastToken = state.accessToken ?? "";
        _socket.auth = { token: lastToken };
        if (_socket.connected) {
          _socket.disconnect().connect();
        }
      }
    });
  }

  return _socket;
}

export function disconnectSocket(): void {
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }
}
