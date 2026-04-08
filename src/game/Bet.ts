import { Socket } from "socket.io";
import { Bet, BetRequest, BetType } from "../data/Bet";
import { Lobby } from "../data/Lobby";
import { GameState } from "../data/Game";
import { DefaultResponse } from "../data/Response";
import { getLobbyByName } from "./Lobby";

export function handleBet(socket: Socket) {
    socket.on('bet', (request: BetRequest, callback: (response: DefaultResponse) => void) => {
        const session = (socket.request as any).session;
        const lobby = getLobbyByName(session.activeLobby);
        if (!lobby) {
            console.log(`Lobby ${session.activeLobby} not found for player ${session.name}`);
            callback({ success: false, message: 'Lobby not found' });
            return;
        }

        if (!lobby.placeBet(session.name, request.bet, callback)) {
            console.log(`Failed to place bet for player ${session.name} in lobby ${lobby.name}. Bet: ${JSON.stringify(request.bet)}`);
            return;
        }

        console.log(`Successfully placed bet for player ${session.name} in lobby ${lobby.name}. Bet: ${JSON.stringify(request.bet)}`);
    });
}

export function isValidBet(bet: Bet, lobby: Lobby, session: any): { valid: boolean; message: string } {
    if (lobby.game === null) {
        return { valid: false, message: 'No active game' };
    }

    switch(bet.type) {
        case BetType.Fold:
            return validateFold(bet, lobby);
        case BetType.Call:
            return validateCall(bet, lobby);
        case BetType.Raise:
            return validateRaise(bet, lobby);
        case BetType.Check:
            return validateCheck(bet, lobby);
    }
    
    return { valid: false, message: 'Invalid bet type' }; // passed through bet type switch statment, so should never reach here
}

function validateFold(bet: Bet, lobby: Lobby): { valid: boolean; message: string } {
    return { valid: true, message: 'Valid fold' };
}

function validateCall(bet: Bet, lobby: Lobby): { valid: boolean; message: string } {
    if (lobby.game!.currentBet == 0)
        return { valid: false, message: 'Invalid call, no current bet to call' };

    // CHANGE: Should be able to call in this scenario, but will be an all-in call
    if (lobby.game!.currentBet > lobby.game!.activePlayers[lobby.game!.bettingPlayerIndex].chips)
        return { valid: false, message: 'Invalid call, current bet exceeds your available chips' };
    
    return { valid: true, message: 'Valid call' };

}

function validateRaise(bet: Bet, lobby: Lobby): { valid: boolean; message: string } {
    if (typeof bet.amount !== 'number' || bet.amount <= lobby.game!.currentBet)
        return { valid: false, message: `Invalid raise, amount must be greater than current bet of ${lobby.game!.currentBet}` };

    if (bet.amount > lobby.game!.activePlayers[lobby.game!.bettingPlayerIndex].chips)
        return { valid: false, message: 'Invalid raise, amount exceeds your available chips' };

    if (lobby.game!.state == GameState.PreFlop && bet.amount < lobby.blinds.bigBlind * 2)
        return { valid: false, message: 'Invalid raise, amount must be at least double the big blind in pre-flop' };
    
    return { valid: true, message: 'Valid raise' };
}

function validateCheck(bet: Bet, lobby: Lobby): { valid: boolean; message: string } {
    const validCheck = lobby.game!.currentBet == 0 || lobby.game!.currentBet == lobby.game!.activePlayers[lobby.game!.bettingPlayerIndex].currentBet; // Can only check if no current bet
    return { valid: validCheck, message: validCheck ? 'Valid check' : 'Invalid check, current bet is not zero' };
}