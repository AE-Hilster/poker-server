export interface Card {
    suit: Suit,
    rank: string,
}

export enum Suit {
    Clubs = 'Clubs',
    Diamonds = 'Diamonds',
    Hearts = 'Hearts',
    Spades = 'Spades',
    Unknown = 'Unknown'
}

export enum RankIndex {
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9,
    Ten = 10,
    Jack = 11,
    Queen = 12,
    King = 13,
    Ace = 14,
    Unknown = 0
}

export const RankString: Map<RankIndex, string> = new Map([
    [RankIndex.Two, '2'],
    [RankIndex.Three, '3'],
    [RankIndex.Four, '4'],
    [RankIndex.Five, '5'],
    [RankIndex.Six, '6'],
    [RankIndex.Seven, '7'],
    [RankIndex.Eight, '8'],
    [RankIndex.Nine, '9'],
    [RankIndex.Ten, '10'],
    [RankIndex.Jack, 'J'],
    [RankIndex.Queen, 'Q'],
    [RankIndex.King, 'K'],
    [RankIndex.Ace, 'A'],
    [RankIndex.Unknown, 'Unknown']
]);

export const RankStringToIndex: Map<string, RankIndex> = new Map([
    ['2', RankIndex.Two],
    ['3', RankIndex.Three],
    ['4', RankIndex.Four],
    ['5', RankIndex.Five],
    ['6', RankIndex.Six],
    ['7', RankIndex.Seven],
    ['8', RankIndex.Eight],
    ['9', RankIndex.Nine],
    ['10', RankIndex.Ten],
    ['J', RankIndex.Jack],
    ['Q', RankIndex.Queen],
    ['K', RankIndex.King],
    ['A', RankIndex.Ace],
    ['Unknown', RankIndex.Unknown]
]);

const suits = [Suit.Clubs, Suit.Diamonds, Suit.Hearts, Suit.Spades];
const ranks: number[] = [RankIndex.Two, RankIndex.Three, RankIndex.Four, RankIndex.Five, RankIndex.Six, RankIndex.Seven, RankIndex.Eight, RankIndex.Nine, RankIndex.Ten, RankIndex.Jack, RankIndex.Queen, RankIndex.King, RankIndex.Ace];

export function getRandomCards(count: number): Card[] {
    const returnedCards: Card[] = [];
    const unusedCards: number[][] = [[...ranks], [...ranks], [...ranks], [...ranks]]; // Track used cards by suit and rank

    while (returnedCards.length < count) {
        const suitIndex = Math.floor(Math.random() * suits.length);
        const rankIndex = Math.floor(Math.random() * unusedCards[suitIndex].length); // Adjust rank index based on used cards in the suit
        
        returnedCards.push({
            suit: suits[suitIndex],
            rank: RankString.get(unusedCards[suitIndex][rankIndex])!
        });

        // Remove the used card from the unusedCards array
        unusedCards[suitIndex].splice(rankIndex, 1);
    }

    return returnedCards;

}

export function getDefaultHand(): [Card, Card] {
    return [
        getDefaultCard(),
        getDefaultCard()
    ];
}

export function getDefaultCard(): Card {
    return {
        suit: Suit.Unknown,
        rank: RankString.get(RankIndex.Unknown)!
    };
}