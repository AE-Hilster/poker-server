import { Card, getDefaultCard, RankIndex, RankStringToIndex } from "./Cards";

export interface HandValue {
    name: string;
    value: number;
    cards: [Card, Card, Card, Card, Card];
}

export enum HandRank {
    HighCard = 0,
    OnePair = 100,
    TwoPair = 200,
    ThreeOfAKind = 300,
    Straight = 400,
    Flush = 500,
    FullHouse = 600,
    FourOfAKind = 700,
    StraightFlush = 800,
    RoyalFlush = 900
}

// Returns hand rank index (0-9) multiplied by 100 plus the highest card rank index for tie-breaking
export function evaluateHand(hand: [Card, Card], communityCards: [Card, Card, Card, Card, Card]): HandValue {
    let flushValue: HandValue = { name: "", value: -1, cards: [getDefaultCard(), getDefaultCard(), getDefaultCard(), getDefaultCard(), getDefaultCard()] } as HandValue;
    const allCards = [...hand, ...communityCards];
    allCards.sort((a, b) => {
        const rankA = RankStringToIndex.get(a.rank) || RankIndex.Unknown;
        const rankB = RankStringToIndex.get(b.rank) || RankIndex.Unknown;
        return rankB - rankA; // Sort in descending order of rank
    });
    const rankCounts: Map<RankIndex, number> = new Map();
    const suitCounts: Map<string, number> = new Map();
    allCards.forEach(card => {
        const rankIndex = RankStringToIndex.get(card.rank) || RankIndex.Unknown;
        rankCounts.set(rankIndex, (rankCounts.get(rankIndex) || 0) + 1);
        suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1);
    });

    suitCounts.forEach((count, suit) => {
        if (count >= 5) {
            if (checkRoyalFlush(allCards, suit)) {
                return {
                    name: "Royal Flush",
                    value: HandRank.RoyalFlush + RankIndex.Ace, // 912, highest possible hand
                    cards: getRoyalFlushCards(allCards, suit)
                };
            }
            const straightFlushResult = checkStraightFlush(allCards, suit);
            if (straightFlushResult.success) {
                return {
                    name: "Straight Flush",
                    value: HandRank.StraightFlush + straightFlushResult.highestRank,
                    cards: getStraightFlushCards(allCards, suit, straightFlushResult.highestRank)
                };
            }
            const cardsOfSuit = getMatchingSuitCards(allCards, suit);
            flushValue = {
                name: "Flush",
                value: HandRank.Flush + getHighestCardRank(cardsOfSuit),
                cards: cardsOfSuit.slice(0, 5) as [Card, Card, Card, Card, Card]
            };
        }
    });

    const threeOfAKindRanks = [],
        pairRanks = [];

    for (let i = RankIndex.Ace; i >= RankIndex.Two; --i) {
        if (rankCounts.get(i) === 4) {
            const kickers = getKickersIndexes(allCards, [i]);
            if (kickers.length > 0) {
                return {
                    name: "Four of a Kind",
                    value: HandRank.FourOfAKind + i + kickers[0] / 100,
                    cards: getCardsOfAKindAmount(allCards, [i], [4], [kickers[0]])
                };
            }
            return {
                name: "Four of a Kind",
                value: HandRank.FourOfAKind + i,
                cards: getCardsOfAKindAmount(allCards, [i], [4], [])
            };
        } else if (rankCounts.get(i) === 3) {
            threeOfAKindRanks.push(i);
        } else if (rankCounts.get(i) === 2) {
            pairRanks.push(i);
        }
    }

    if (threeOfAKindRanks.length > 0 && pairRanks.length > 0) {
        return {
            name: "Full House",
            value: HandRank.FullHouse + fullHouseValue(allCards),
            cards: getCardsOfAKindAmount(allCards, [threeOfAKindRanks[0], pairRanks[0]], [3, 2], [])
        };
    }

    if (flushValue && flushValue.value != -1)
        return flushValue;

    const straightResult = checkStraight(allCards);
    if (straightResult.success) {
        return {
            name: "Straight",
            value: HandRank.Straight + straightResult.highestRank,
            cards: getStraightCards(allCards, straightResult.highestRank)
        };
    }

    if (threeOfAKindRanks.length > 0) {
        const kickers = getKickersIndexes(allCards, [threeOfAKindRanks[0]]);
        if (kickers.length > 0) {
            const kicker1 = kickers[0];
            const kicker2 = kickers.length > 1 ? kickers[1] : RankIndex.Unknown;
            return {
                name: "Three of a Kind",
                value: HandRank.ThreeOfAKind + threeOfAKindRanks[0] + kicker1 / 100 + kicker2 / 10000,
                cards: getCardsOfAKindAmount(allCards, [threeOfAKindRanks[0]], [3], [kicker1, kicker2])
            };
        }
        return {
            name: "Three of a Kind",
            value: HandRank.ThreeOfAKind + threeOfAKindRanks[0],
            cards: getCardsOfAKindAmount(allCards, [threeOfAKindRanks[0]], [3], [])
        };
    } else if (pairRanks.length >= 2) {
        const kickers = getKickersIndexes(allCards, [pairRanks[0], pairRanks[1]]);
        if (kickers.length > 0) {
            const kicker = kickers[0];
            return {
                name: "Two Pair",
                value: HandRank.TwoPair + twoPairValue(allCards) + kicker / 10000,
                cards: getCardsOfAKindAmount(allCards, [pairRanks[0], pairRanks[1]], [2, 2], [kicker])
            };
        }
        return {
            name: "Two Pair",
            value: HandRank.TwoPair + twoPairValue(allCards),
            cards: getCardsOfAKindAmount(allCards, [pairRanks[0], pairRanks[1]], [2, 2], [])
        };
    } else if (pairRanks.length === 1) {
        const kickers = getKickersIndexes(allCards, [pairRanks[0]]);
        if (kickers.length > 0) {
            const kicker1 = kickers[0];
            const kicker2 = kickers.length > 1 ? kickers[1] : RankIndex.Unknown;
            const kicker3 = kickers.length > 2 ? kickers[2] : RankIndex.Unknown;
            return {
                name: "One Pair",
                value: HandRank.OnePair + pairValue(allCards) + kicker1 / 100 + kicker2 / 10000 + kicker3 / 1000000,
                cards: getCardsOfAKindAmount(allCards, [pairRanks[0]], [2], [kicker1, kicker2, kicker3])
            };
        }
        return {
            name: "One Pair",
            value: HandRank.OnePair + pairValue(allCards),
            cards: getCardsOfAKindAmount(allCards, [pairRanks[0]], [2], [])
        };
    }

    const indexes = getIndexOfCards(allCards);
    return {
        name: "High Card",
        value: HandRank.HighCard + indexes[0] + indexes[1] / 100 + indexes[2] / 10000 + indexes[3] / 1000000 + indexes[4] / 100000000,
        cards: getCardsOfAKindAmount(allCards, indexes, [1, 1, 1, 1, 1], [])
    };
}

function checkRoyalFlush(allCards: Card[], suit: string): boolean {
    const matchingSuitCards = getMatchingSuitCards(allCards, suit);
    const hasAce = matchingSuitCards.some(card => card.rank === 'A');
    const hasKing = matchingSuitCards.some(card => card.rank === 'K');
    const hasQueen = matchingSuitCards.some(card => card.rank === 'Q');
    const hasJack = matchingSuitCards.some(card => card.rank === 'J');
    const hasTen = matchingSuitCards.some(card => card.rank === '10');
    return hasAce && hasKing && hasQueen && hasJack && hasTen;
}

function getRoyalFlushCards(allCards: Card[], suit: string): [Card, Card, Card, Card, Card] {
    const matchingSuitCards = getMatchingSuitCards(allCards, suit);
    const royalFlushCards: [Card, Card, Card, Card, Card] = [null as any, null as any, null as any, null as any, null as any];
    ['A', 'K', 'Q', 'J', '10'].forEach((rank, index) => {
        const card = matchingSuitCards.find(c => c.rank === rank);
        if (card) {
            royalFlushCards[index] = card;
        }
    });
    return royalFlushCards;
}

function checkStraightFlush(allCards: Card[], suit: string): {success: boolean, highestRank: number} {
    const matchingSuitCards = getMatchingSuitCards(allCards, suit);
    return checkStraight(matchingSuitCards);
}

function getStraightFlushCards(allCards: Card[], suit: string, highestRank: number): [Card, Card, Card, Card, Card] {
    const matchingSuitCards = getMatchingSuitCards(allCards, suit);
    return getStraightCards(matchingSuitCards, highestRank);
}

function getStraightCards(allCards: Card[], highestRank: number): [Card, Card, Card, Card, Card] {
    const straightCards: [Card, Card, Card, Card, Card] = [null as any, null as any, null as any, null as any, null as any];
    let currentRank = highestRank;
    for (let i = 0; i < straightCards.length; ++i) {
        const card = allCards.find(c => (RankStringToIndex.get(c.rank) || RankIndex.Unknown) === currentRank);
        if (card) {
            straightCards[i] = card;
            --currentRank;
        } else {
            break;
        }
    }
    return straightCards;
};

function getMatchingSuitCards(allCards: Card[], suit: string): Card[] {
    return allCards.filter(card => card.suit === suit);
}

function checkStraight(allCards: Card[]): {success: boolean, highestRank: number} {
    let lastRankIndex = -1;
    let consecutiveCount = 0;
    let highestRank = RankIndex.Unknown;
    for (const card of allCards) {
        const rankIndex = RankStringToIndex.get(card.rank) || RankIndex.Unknown;
        if (rankIndex === RankIndex.Unknown) continue;
        if (lastRankIndex === -1 || rankIndex === lastRankIndex - 1) {
            ++consecutiveCount;
            if (rankIndex > highestRank) {
                highestRank = rankIndex;
            }
            if (consecutiveCount >= 5) {
                return { success: true, highestRank };
            }
        } else if (rankIndex !== lastRankIndex) {
            consecutiveCount = 1;
            highestRank = rankIndex;
        }
        lastRankIndex = rankIndex;
    }

    return { success: false, highestRank: RankIndex.Unknown };
}

function getCardsOfAKindAmount(allCards: Card[], ranks: RankIndex[], amounts: number[], kickerRank: number[]): [Card, Card, Card, Card, Card] {
    const result: [Card, Card, Card, Card, Card] = [null as any, null as any, null as any, null as any, null as any];
    amounts.forEach((amount, index) => {
        const cardsOfRank = getCardsOfAKind(allCards, ranks[index], amount);
        cardsOfRank.forEach((card, i) => {
            result[i] = card;
        });
    });
    const count = ranks.reduce((sum, rank) => sum + amounts[ranks.indexOf(rank)], 0);
    kickerRank.forEach((rank, index) => {
        const kickerCard = allCards.find(card => (RankStringToIndex.get(card.rank) || RankIndex.Unknown) === rank);
        if (kickerCard) {
            result[count + index] = kickerCard;
            allCards.splice(allCards.indexOf(kickerCard), 1);
        }
    });
    return result;
}

function getCardsOfAKind(allCards: Card[], rank: RankIndex, count: number): Card[] {
    const cardsOfRank = allCards.filter(card => (RankStringToIndex.get(card.rank) || RankIndex.Unknown) === rank);
    const result: Card[] = [];
    for (let i = 0; i < count; ++i) {
        result.push(cardsOfRank[i]);
        allCards.splice(allCards.indexOf(cardsOfRank[i]), 1);
    }
    return result;
}

function fullHouseValue(cards: Card[]): number {
    const threeOfAKind = threeOfAKindValue(cards);
    if (threeOfAKind === RankIndex.Unknown) {
        return RankIndex.Unknown;
    }
    const pair = pairValue(cards, threeOfAKind);
    if (pair === RankIndex.Unknown) {
        return threeOfAKind;
    }
    return threeOfAKind + pair / 100;
}

function threeOfAKindValue(cards: Card[]): number {
    const rankCounts: Map<RankIndex, number> = new Map();
    cards.forEach(card => {
        const rankIndex = RankStringToIndex.get(card.rank) || RankIndex.Unknown;
        rankCounts.set(rankIndex, (rankCounts.get(rankIndex) || 0) + 1);
    });
    for (let i = RankIndex.Ace; i >= RankIndex.Two; --i) {
        if (rankCounts.get(i) === 3) {
            return i;
        }
    }
    return RankIndex.Unknown;
}

function twoPairValue(cards: Card[]): number {
    const highestPairValue = pairValue(cards);
    if (highestPairValue === RankIndex.Unknown) {
        return RankIndex.Unknown;
    }
    const secondPairValue = pairValue(cards, highestPairValue);
    if (secondPairValue === RankIndex.Unknown) {
        return highestPairValue;
    }
    return highestPairValue + secondPairValue / 100;
}

function pairValue(cards: Card[], exception = RankIndex.Unknown): number {
    const rankCounts: Map<RankIndex, number> = new Map();
    cards.forEach(card => {
        const rankIndex = RankStringToIndex.get(card.rank) || RankIndex.Unknown;
        rankCounts.set(rankIndex, (rankCounts.get(rankIndex) || 0) + 1);
    });
    for (let i = RankIndex.Ace; i >= RankIndex.Two; --i) {
        if (i === exception) continue;
        if (rankCounts.get(i) === 2) {
            return i;
        }
    }
    return RankIndex.Unknown;
}

function getHighestCardRank(cards: Card[]): number {
    let highestRank = RankIndex.Unknown;
    cards.forEach(card => {
        const rankIndex = RankStringToIndex.get(card.rank) || RankIndex.Unknown;
        if (rankIndex > highestRank) {
            highestRank = rankIndex;
        }
    });
    return highestRank;
}

function getKickersIndexes(cards: Card[], exceptionRanks: RankIndex[]): number[] {
    const kickers = getKickers(cards, exceptionRanks);
    return getIndexOfCards(kickers);
}

function getKickers(cards: Card[], exceptionRanks: RankIndex[]): Card[] {
    const kickers: Card[] = [];
    cards.forEach(card => {
        const rankIndex = RankStringToIndex.get(card.rank) || RankIndex.Unknown;
        if (!exceptionRanks.includes(rankIndex)) {
            kickers.push(card);
        }
    });
    return kickers;
}

function getIndexOfCards(cards: Card[]): number[] {
    return cards.map(card => RankStringToIndex.get(card.rank) || RankIndex.Unknown);
}