import { Socket } from "socket.io";
import { io } from "../index";
import { DefaultResponse } from "./Response";
import { findLobbyByName } from "../game/Lobby";

const users: string[] = [];

export function handleUser(socket: Socket) {
    socket.on('disconnect', () => {
        disconnectUser(socket);
    });
    socket.on('set name', (name: string, callback: (response: DefaultResponse) => void) => {
        storeName(socket, name, callback);
    });
}

function storeName(socket: Socket, name: string, callback: (response: DefaultResponse) => void) {
    if (users.some(existingName => existingName.toLowerCase() === name.toLowerCase())) { // name exists
        console.log(`Name ${name} already exists, choose different name`);
        callback({
            success: false,
            message: 'Name already in use'
        });
    } else {
        saveName(socket, name);
        console.log('Name stored successfully');
        callback({
            success: true,
            message: 'Name stored successfully'
        });
    }
    console.log('Current users:', users);
}

function disconnectUser(socket: Socket) {
    const session = (socket.request as any).session;
    if (!session.name) {
        console.log(`User with session ID ${session.id} disconnected but had no name set`);
    }

    const index = users.indexOf(session.name);
    if (index == -1) {
        console.log(`User ${session.name} disconnected but was not found in users list`);
    }

    users.splice(index, 1);
    console.log(`User ${session.name} disconnected and removed from users list`);
    console.log('Current users:', users);

    if (!session.activeLobby) {
        console.log(`User ${session.name} disconnected but was not in a lobby`);
        return;
    }
    
    const lobbyName = session.activeLobby;
    const lobby = findLobbyByName(lobbyName);
    if (!lobby) {
        console.log(`Lobby ${lobbyName} not found for player ${session.name} disconnection`);
        return;
    }

    const player = lobby.disconnectPlayer(session.name);
    if (player && typeof player != 'boolean') {
        io.to(lobbyName).emit('player disconnected', { player: player });
        io.to(lobbyName).emit('player unready', { player: player });
        console.log(`Player ${player.name} marked as disconnected in lobby ${lobbyName}`);
        return;
    }
    
    console.log(`Player ${session.name} not found in lobby ${lobbyName} for disconnection`);
}

function saveName(socket: Socket, name: string) {
    const session = (socket.request as any).session;

    users.push(name);

    session.name = name;
    session.save();
}