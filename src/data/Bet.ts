export interface Bet {
    amount?: number; // Only required for raise
    type: BetType;
}

export enum BetType {
    Fold = "fold",
    Call = "call",
    Raise = "raise",
    Check = "check"
}

export interface BetRequest {
    bet: Bet;
}
