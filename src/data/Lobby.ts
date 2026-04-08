import session from "express-session";
import { io } from "..";
import { Card, getDefaultCard, getDefaultHand } from "./Cards";
import { evaluateGame, Game, GameState, getInitialisedGame } from "./Game";
import { Bet, BetType } from "./Bet";
import { isValidBet } from "../game/Bet";
import { DefaultResponse } from "./Response";
import { gameStartCountdown } from "../game";

export interface Player {
    name: string;
    chips: number;
    currentBet: number;
    hand: [Card, Card];

    ready: boolean;
    connected: boolean;
}

export class Lobby {
    private _name: string;
    private _players: Player[];
    private _game: Game | null;
    private _dealerName: string;
    private _bigBlind: number;
    private _smallBlind: number;
    private _starting = false;

    constructor(name: string, players: Player[], bigBlind: number = 10, smallBlind: number = 5) {
        this._name = name;
        this._players = players;
        this._game = null;
        this._dealerName = players[0]?.name || "";
        this._bigBlind = bigBlind;
        this._smallBlind = smallBlind;
    }

    public get name(): string {
        return this._name;
    }

    public get game(): Game | null {
        return this._game;
    }

    public get players(): Player[] {
        return this._players;
    }

    public get blinds(): { bigBlind: number; smallBlind: number } {
        return { bigBlind: this._bigBlind, smallBlind: this._smallBlind };
    }

    public set starting(value: boolean) {
        this._starting = value;
    }

    public get starting(): boolean {
        return this._starting;
    }

    public getPlayerByName(playerName: string): Player | null {
        return this._players.find(player => player.name.toLowerCase() === playerName.toLowerCase()) || null;
    }

    public addPlayer(playerName: string): boolean {
        const existingPlayer = this.getPlayerByName(playerName);
        if (existingPlayer !== null) {
            console.log(`Player ${playerName} already in lobby ${this.name}`);
            existingPlayer.connected = true; // Reconnect player if they are already in the lobby
            io.to(this.name).emit('player reconnected', { player: existingPlayer });
            return true; // Player already in lobby
        }

        const newPlayer: Player = {
            name: playerName,
            chips: 1000, // Default starting chips
            hand: getDefaultHand(),
            currentBet: 0,
            ready: false,
            connected: true,
        };

        this._players.push(newPlayer);
        io.to(this.name).emit('player joined', { player: newPlayer });
        return true;
    }

    public disconnectPlayer(playerName: string): Player | boolean {
        const player = this.getPlayerByName(playerName);
        if (player === null) {
            return false; // Player not found in lobby
        }
        player.ready = false;
        player.connected = false;
        return player;
    }

    public removePlayer(playerName: string): boolean {
        const index = this._players.findIndex(player => player.name.toLowerCase() === playerName.toLowerCase());
        if (index !== -1) {
            this._players.splice(index, 1);
            return true;
        }
        return false;
    }

    public updatePlayerConnectionStatus(playerName: string, connected: boolean): boolean {
        const player = this.getPlayerByName(playerName);
        if (player === null) {
            return false; // Player not found in lobby
        }
        player.connected = connected;
        return true;
    }

    public checkStartGame(): boolean {
        if (this._game !== null && this._game.state !== GameState.Showdown) {
            console.log(`Game already in progress in lobby ${this.name}`);
            return false; // Game already in progress
        }
        if (this._players.filter(player => player.ready).length < 2) {
            console.log(`Not enough ready players to start game in lobby ${this.name}`);
            return false; // Not enough ready players
        }
        return true;
    }

    public startGame(): boolean {
        if (!this.checkStartGame()) {
            return false; // Cannot start game
        }
        const readyPlayers = this._players.filter(player => player.ready);
            const currentDealerIndex = readyPlayers.findIndex(player => player.name === this._dealerName);
        if (currentDealerIndex === -1) {
            this._dealerName = readyPlayers[0].name; // Set first ready player as dealer if current dealer is not valid
        } else {
            // Rotate dealer to next ready player
            const nextDealerIndex = (currentDealerIndex + 1) % readyPlayers.length;
            this._dealerName = readyPlayers[nextDealerIndex].name;
        }
        this._game = getInitialisedGame(readyPlayers, this._dealerName, { bigBlind: this._bigBlind, smallBlind: this._smallBlind });
        
        sendGameState(this, 'game started');

        return true;
    }

    public placeBet(playerName: string, bet: Bet, callback: (response: DefaultResponse) => void): boolean {
        const { game } = this;

        if (!game) {
            console.log(`No active game in lobby ${this.name} for player ${playerName}'s bet`);
            callback({ success: false, message: 'No active game' });
            return false;
        }

        if (game.state === GameState.Deal || game.state === GameState.Showdown || game.state === GameState.None) {
            callback({ success: false, message: 'Cannot bet at this time' });
            return false;
        }

        const bettingPlayer = game.activePlayers[game.bettingPlayerIndex];
        if (bettingPlayer.name !== playerName) {
            console.log(`It's not player ${playerName}'s turn to bet in lobby ${this.name}`);
            callback({ success: false, message: 'Not your turn' });
            return false;
        }

        console.log(`Received bet from player ${playerName} in lobby ${this.name}:`, bet);
        const validation = isValidBet(bet, this, session);
        if (!validation.valid) {
            console.log(`Invalid bet from player ${playerName} in lobby ${this.name}:`, validation.message);
            callback({ success: false, message: validation.message });
            return false;
        }

        if (bet.type == BetType.Raise) {
            game.currentBet = bet.amount!;
            game.lastRaiser = game.activePlayers[game.bettingPlayerIndex].name;
        }

        if (bet.type == BetType.Fold) {
            game.activePlayers = game.activePlayers.filter(player => player.name !== playerName);
            this._addBetToPot(bettingPlayer); // Add current player's bet to pot when they fold
        } else {
            if (game.lastRaiser === '')
                game.lastRaiser = bettingPlayer.name;

            const betIncrease = (bet.amount || 0) - bettingPlayer.currentBet;
            bettingPlayer.chips -= betIncrease > 0 ? betIncrease : 0; // Deduct chips for raise or call, but not for check
            bettingPlayer.currentBet += betIncrease > 0 ? betIncrease : 0; // Update current bet for raise or call, but not for check
            ++game.bettingPlayerIndex;
        }

        if (game.bettingPlayerIndex >= game.activePlayers.length)
            game.bettingPlayerIndex = 0;
        
        // End game if only one player left
        if (game.activePlayers.length == 1) {
            game.state = GameState.Showdown;
            this._addBetsToPot();
        } else if (game.activePlayers[game.bettingPlayerIndex].name === game.lastRaiser) {
            // End betting game
            this._addBetsToPot();
            game.bettingPlayerIndex = 0; // CHANGE to first active player after dealer
            game.lastRaiser = '';
            game.currentBet = 0;

            ++game.state;
        }

        callback({ success: true, message: validation.message });

        if (game.state === GameState.Showdown) {
            evaluateGame(this._name, game);
            gameStartCountdown(this); // Start countdown for next game
        }

        sendGameState(this, 'game updated');

        return true;
    }

    private _addBetToPot(player: Player): void {
        if (!this.game) return;

        console.log(`Adding player ${player.name}'s bet of ${player.currentBet} to the pot`);
        
        this.game.pot += player.currentBet;
        player.currentBet = 0;
    }

    private _addBetsToPot(): void {
        if (!this.game) return;

        for (const player of this.game.activePlayers) {
            this._addBetToPot(player);
        }
        
        console.log(`Total pot is now ${this.game.pot}`);
        console.log(`Player states after adding bets to pot:`, this.game.activePlayers.map(player => ({ name: player.name, chips: player.chips, currentBet: player.currentBet })));
    }
}

function sendGameState(lobby: Lobby, event: string): void {
    io.in(lobby.name).fetchSockets().then(sockets => {
        sockets.forEach(socket => {
            const session = socket.data.session;
            if (session && session.name) {
                io.to(socket.id).emit(event, { success: true, message: "Game started", game: copyGameAndHidePlayerHands(lobby.game as Game, session.name) });
            } else {
                console.log(`No session or name found for socket ${socket.id} in lobby ${lobby.name} when starting game`);
                io.to(socket.id).emit(event, { success: true, message: "Game started", game: copyGameAndHidePlayerHands(lobby.game as Game, '') });
            }
        });
    });
}

export function copyGameAndHidePlayerHands(game: Game, playerName: string): Game {
    const hiddenHandGame = { ...game,
        activePlayers: game.activePlayers.map(player => {
            if (player.name === playerName || game.state === GameState.Showdown) {
                return player; // Don't hide hand for the requesting player
            } else {
                return { ...player, hand: getDefaultHand() }; // Hide hand for other players
            }
        }),
        communityCards: hideCommunityCards(game) // Hide community cards
    };
    return hiddenHandGame;
}

function hideCommunityCards(game: Game): [Card, Card, Card, Card, Card] {
    const {state} = game;
    const hideAmount = state === GameState.PreFlop || state === GameState.Deal ? 5
        : state === GameState.Flop ? 2
        : state === GameState.Turn ? 1
        : 0; // Number of community cards to hide based on game state
    return game.communityCards.map((card, index) => index >= 5 - hideAmount ? getDefaultCard() : card) as [Card, Card, Card, Card, Card];
}