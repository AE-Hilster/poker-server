import { io } from "..";
import { Card, getDefaultCard, getRandomCards } from "./Cards";
import { evaluateHand, HandValue } from "./Hands";
import { Player } from "./Lobby";

export interface Game {
    state: GameState;
    pot: number;
    communityCards: [Card, Card, Card, Card, Card];
    currentBet: number;
    activePlayers: Player[]; // Players still in the hand (haven't folded)
    lastRaiser: string;
    bettingPlayerIndex: number;
}

export enum GameState {
    Deal = 0,
    PreFlop,
    Flop,
    Turn,
    River,
    Showdown,
    None
}

export function getDefaultGame(players: Player[]): Game {
    return {
        state: GameState.None,
        pot: 0,
        communityCards: [getDefaultCard(), getDefaultCard(), getDefaultCard(), getDefaultCard(), getDefaultCard()],
        currentBet: 0,
        activePlayers: players,
        lastRaiser: '',
        bettingPlayerIndex: 0
    };
}

export function getInitialisedGame(players: Player[], dealersName: string, blind: { bigBlind: number; smallBlind: number }): Game {
    const dealerIndex = players.findIndex(player => player.name === dealersName);
    if (dealerIndex === -1) {
        throw new Error(`Dealer ${dealersName} not found among players`);
    }

    const cards = getRandomCards(players.length * 2 + 5); // Get enough cards for all players and community cards
    const firstBettingPlayerIndex = (dealerIndex + 3) % players.length; // First betting player is the one after the big blind
    const bigBlindIndex = (dealerIndex + 2) % players.length;
    const smallBlindIndex = (dealerIndex + 1) % players.length;
    players.forEach((player, index) => {
        player.currentBet = 0;
        if (index === bigBlindIndex) {
            player.currentBet = blind.bigBlind; // Big blind amount
            player.chips -= blind.bigBlind; // Deduct big blind from player's chips
        } else if (index === smallBlindIndex) {
            player.currentBet = blind.smallBlind; // Small blind amount
            player.chips -= blind.smallBlind; // Deduct small blind from player's chips
        }
        player.hand = [cards[index * 2], cards[index * 2 + 1]];
    });

    return {
        state: GameState.PreFlop,
        pot: 0,
        communityCards: cards.slice(players.length * 2, players.length * 2 + 5) as [Card, Card, Card, Card, Card],
        currentBet: blind.bigBlind,
        activePlayers: players,
        lastRaiser: '', // No raiser yet
        bettingPlayerIndex: firstBettingPlayerIndex // First betting player is the one after the big blind
    };
}

export function evaluateGame(lobbyName: string, game: Game): void {
    const playerHands = game.activePlayers.map(player => {
        return {
            player: player,
            handValue: evaluateHand(player.hand as [Card, Card], game.communityCards)
        };
    });
    playerHands.sort((a, b) => b.handValue.value - a.handValue.value); // Sort in descending order of hand value
    
    const winners = [];
    let currentWinningValue = playerHands[0].handValue;
    for (const playerHand of playerHands) {
        if (playerHand.handValue.value === currentWinningValue.value) {
            winners.push(playerHand);
        } else {
            break; // Since sorted, can stop once we find a lower hand value
        }
    }

    winners.forEach(winner => {
        console.log(`Winner: ${winner.player.name} with hand value: ${currentWinningValue.value}`);
        winner.player.chips += game.pot / winners.length; // Split pot among winners
    });

    sendWinningHandMessage(lobbyName, winners, game.pot / winners.length);
    game.pot = 0; // Reset pot after awarding
    game.bettingPlayerIndex = -1; // Stop betting loop since game is over
}

function sendWinningHandMessage(lobbyName: string, winners: {player: Player, handValue: HandValue}[], amountWon: number): void {
    io.in(lobbyName).emit("winners", {
        winners: winners,
        amountWon: amountWon
    });
}