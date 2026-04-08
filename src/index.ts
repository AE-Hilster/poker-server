import express from "express"; 
import { Application } from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import session from 'express-session';
import { handleUser } from './data/Users';
import { handleGame } from "./game";
import { handleLobbies } from "./game/Lobby";

const app: Application = express();
const server = createServer(app);
export const io = new Server(server, {
    cors: {
        origin: "http://localhost:8000",
        methods: ["GET", "POST"]
    }
});

const sessionMiddleware = session({
    secret: "topsecret",
    resave: false,
    saveUninitialized: true,
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

io.on('connection', (socket) => {
    const session = (socket.request as any).session;
    const sessionId = (socket.request as any).session.id;
    
    // Store session data in socket.data for access via fetchSockets()
    socket.data.session = session;
    
    if (!session.name) {
        console.log(`User connected: ${sessionId}`);
    } else {
        console.log(`User reconnected: ${sessionId} with name ${session.name}`);
    }
    handleUser(socket);
    handleLobbies(socket);
    handleGame(socket);
});

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});