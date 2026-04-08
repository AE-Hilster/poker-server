import { Socket } from "socket.io";
import { io } from "../index.js";
import { handleBet } from "./Bet.js";
import { Lobby } from "../data/Lobby.js";

export function handleGame(socket: Socket) {
    handleBet(socket);
}

export async function gameStartCountdown(lobby: Lobby) {
    if (lobby.starting){
        console.log(`Game start already in countdown in lobby ${lobby.name}`);
        return;
    }

    const players = lobby.players.filter(player => player.ready);
    console.log(`Starting game in lobby ${lobby.name} with players: ${players.map(p => p.name).join(', ')}`);
    lobby.starting = true;
    
    // Start countdown from 10
    let countdown = 10;
    console.log(`Game starts in ${countdown} seconds...`);
    
    const countdownInterval = setInterval(async () => {
        countdown--;
        
        // Stop countdown if not enough players
        if (!lobby.checkStartGame()) {
            clearInterval(countdownInterval);
            console.log(`Countdown stopped - not enough players (${lobby.players.filter(player => player.ready).length}/2 in lobby ${lobby.name})`);
            io.to(lobby.name).emit('announcement', { message: 'Not enough players to start the game' });
            lobby.starting = false;
            return;
        }
        
        // Continue countdown or finish
        if (countdown > 0) {
            console.log(`Game starts in ${countdown} seconds...`);
            io.to(lobby.name).emit('announcement', { message: `Game starts in ${countdown} seconds...` });
        } else {
            clearInterval(countdownInterval);
            console.log('Game starting now!');
            lobby.starting = false;
            io.to(lobby.name).emit('announcement', { message: 'Game is starting now!' });
            if (!lobby.startGame()) {
                console.log(`Failed to start game in lobby ${lobby.name} after countdown`);
                io.to(lobby.name).emit('announcement', { message: 'Failed to start game' });
            }
        }
    }, 1000);
}