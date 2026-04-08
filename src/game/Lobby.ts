import { Socket } from "socket.io";
import { copyGameAndHidePlayerHands, Lobby, Player } from "../data/Lobby";
import { io } from "..";
import { getDefaultHand } from "../data/Cards";
import { DefaultResponse } from "../data/Response";
import { gameStartCountdown } from ".";
import { Game } from "../data/Game";

const lobbies: Lobby[] = [];

export function handleLobbies(socket: Socket) {
    const session = (socket.request as any).session;

    socket.on('create lobby', (lobbyName: string, callback: (response: DefaultResponse) => void) => {
        if (findLobbyByName(lobbyName)) {
            console.log(`Lobby ${lobbyName} already exists, choose different name`);
            callback({ success: false, message: 'Lobby name already in use' });
            return;
        }

        lobbies.push(createLobby(lobbyName, [session.name]));
        setActiveLobby(socket, lobbyName);

        console.log(`Lobby ${lobbyName} created successfully`);
        callback({ success: true, message: 'Lobby created successfully' });
    });
    
    socket.on('join lobby', (lobbyName: string, callback: (response: DefaultResponse) => void) => {
        const lobby = findLobbyByName(lobbyName);
        if (!lobby) {
            console.log(`Lobby ${lobbyName} not found`);
            callback({ success: false, message: 'Lobby not found' });
            return;
        }
        // Add player to lobby
        const playerName = session.name;
        if (!lobby.addPlayer(playerName)) {
            console.log(`Player ${playerName} failed to join lobby: ${lobbyName}`);
            callback({ success: false, message: 'Failed to join lobby' });
            return;
        }
        
        setActiveLobby(socket, lobbyName);
        console.log(`Player ${playerName} joined lobby: ${lobbyName}`);
        callback({ success: true, message: 'Joined lobby successfully' });
    });

    socket.on('ready', (callback: (response: DefaultResponse) => void) => {
        const lobbyName = session.activeLobby;
        const lobby = findLobbyByName(lobbyName);
        if (!lobby) {
            console.log(`Lobby ${lobbyName} not found for player ${session.name} readying up`);
            callback({ success: false, message: 'Lobby not found' });
            return;
        }
        const player = lobby.getPlayerByName(session.name);
        if (!player) {
            console.log(`Player ${session.name} not found in lobby ${lobbyName} for readying up`);
            callback({ success: false, message: 'Player not found in lobby' });
            return;
        }
        player.ready = true;
        io.to(lobbyName).emit('player ready', { player: player });
        console.log(`Player ${session.name} is ready in lobby ${lobbyName}`);
        callback({ success: true, message: 'Player marked as ready' });

        if (lobby.checkStartGame()) {
            gameStartCountdown(lobby);
        }
    });

    socket.on('unready', (callback: (response: DefaultResponse) => void) => {
        const lobbyName = session.activeLobby;
        const lobby = findLobbyByName(lobbyName);
        if (!lobby) {
            console.log(`Lobby ${lobbyName} not found for player ${session.name} unreadying`);
            callback({ success: false, message: 'Lobby not found' });
            return;
        }
        const player = lobby.getPlayerByName(session.name);
        if (!player) {
            console.log(`Player ${session.name} not found in lobby ${lobbyName} for unreadying`);
            callback({ success: false, message: 'Player not found in lobby' });
            return;
        }
        player.ready = false;
        io.to(lobbyName).emit('player unready', { player: player });
        console.log(`Player ${session.name} is not ready in lobby ${lobbyName}`);
        callback({ success: true, message: 'Player marked as not ready' });
    });

    socket.on('leave lobby', (callback: (response: DefaultResponse) => void) => {
        const session = (socket.request as any).session;
        const lobbyName = session.activeLobby;
        const lobby = findLobbyByName(lobbyName);
        if (!lobby) {
            console.log(`Lobby ${lobbyName} not found for player ${session.name} leaving lobby`);
            callback({ success: false, message: 'Lobby not found' });
            return;
        }
        if (lobby.removePlayer(session.name)) {
            socket.leave(lobbyName);
            delete session.activeLobby;
            session.save();
            
            io.to(lobbyName).emit('player left', { player: session });
            console.log(`Player ${session.name} left lobby: ${lobbyName}`);
            callback({ success: true, message: 'Left lobby successfully' });
        } else {
            console.log(`Player ${session.name} failed to leave lobby: ${lobbyName}`);
            callback({ success: false, message: 'Failed to leave lobby' });
        }
    });

    // GETTERS
    socket.on('get lobbies', (callback: (response: { success: boolean; message: string; lobbies: string[] }) => void) => {
        if (lobbies.length === 0) {
            lobbies.push(createLobby('Default Lobby', []));
        }
        const lobbyNames = getLobbyNames();
        console.log(`Sending lobby list to player ${(socket.request as any).session.name}: ${lobbyNames.join(', ')}`);
        callback({ success: true, message: 'Lobbies retrieved successfully', lobbies: lobbyNames });
    });

    socket.on('get lobby info', (lobbyName: string, callback: (response: { success: boolean; message: string; players: Player[], game: Game | null }) => void) => {
        const lobby = getLobbyByName(lobbyName);
        if (!lobby) {
            console.log(`Lobby ${lobbyName} not found for player ${(socket.request as any).session.name} requesting lobby info`);
            callback({ success: false, message: 'Lobby not found', players: [], game: null });
            return;
        }
        const players = lobby.players;
        console.log(`Sending ${lobbyName} lobby info to player ${(socket.request as any).session.name}`);
        callback({ success: true, message: 'Lobbies retrieved successfully', players:
            players ? players.map(player => ({ ...player, hand: getDefaultHand() })) : [], game: lobby.game ? copyGameAndHidePlayerHands(lobby.game, session.name) : null });

    });
}

function setActiveLobby(socket: Socket, lobbyName: string): boolean {
    if (!findLobbyByName(lobbyName)) {
        console.log(`Lobby ${lobbyName} not found`);
        return false;
    }

    // Add player to lobby
    const session = (socket.request as any).session;
    session.activeLobby = lobbyName;
    session.save();
    socket.join(lobbyName);

    return true;
}

function getLobbyNames(): string[] {
    return lobbies.map(lobby => lobby.name);
}

export function getLobbyByName(name: string): Lobby | null {
    return lobbies.find(lobby => lobby.name === name) || null;
}

function createLobby(name: string, players: string[], bigBlind?: number, smallBlind?: number): Lobby {
    if (findLobbyByName(name)) {
        throw new Error(`Lobby with name ${name} already exists`);
    }

    const playerObjects: Player[] = players.map(playerName => ({
        name: playerName,
        chips: 1000, // Default starting chips
        hand: getDefaultHand(),
        currentBet: 0,
        ready: false,
        connected: true,
    }));


    return new Lobby(name, playerObjects, bigBlind, smallBlind);
}

export function findLobbyByName(name: string): Lobby | null {
    return lobbies.find(lobby => lobby.name.toLowerCase() === name.toLowerCase()) || null;
}