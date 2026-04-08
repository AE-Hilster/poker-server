import { Game } from "./Game";
import { Lobby } from "./Lobby";

export interface DefaultResponse {
    success: boolean;
    message: string;
}

export interface GameStartResponse extends DefaultResponse {
    game?: Game;
}