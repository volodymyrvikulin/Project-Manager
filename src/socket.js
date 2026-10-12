import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

let socket = null;

export const getSocket = () => {
    if (!socket) {
        socket = io(SOCKET_URL, {
            autoConnect: true,
            transports: ['websocket', 'polling'],
        });
    }
    return socket;
};

export default getSocket;

