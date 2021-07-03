import { nanoid } from "nanoid";
// @ts-ignore
import { StateApp } from "./main";

const stateApp = new StateApp(() => {});

stateApp.createMatchIfEnoughPlayers(nanoid());
stateApp.addQueueEntry("one");
stateApp.addQueueEntry("two");
stateApp.addQueueEntry("three");
stateApp.addQueueEntry("four");
stateApp.addQueueEntry("five");
stateApp.addQueueEntry("six");
stateApp.addQueueEntry("seven");
stateApp.addQueueEntry("eight");
stateApp.addQueueEntry("nine");
stateApp.addQueueEntry("ten");
stateApp.addQueueEntry("evelen");
stateApp.addQueueEntry("twelve");
const gameId = nanoid();
stateApp.createMatchIfEnoughPlayers(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
console.log("day 1, player 5 speaks");
stateApp.nominate(gameId, stateApp.getPlayerId(gameId, 5), 5);
stateApp.next(gameId);
console.log("day 1, player 6 speaks");
stateApp.nominate(gameId, stateApp.getPlayerId(gameId, 6), 3);
stateApp.next(gameId);
console.log("day 1, player 7 speaks");
stateApp.nominate(gameId, stateApp.getPlayerId(gameId, 7), 1);
stateApp.next(gameId);
console.log("day 1, player 8 speaks");
stateApp.nominate(gameId, stateApp.getPlayerId(gameId, 8), 2);
stateApp.next(gameId);
console.log("day 1, player 9 speaks");
stateApp.next(gameId);
console.log("day 1, player 10 speaks");
stateApp.next(gameId);
console.log("voting announced");
stateApp.next(gameId);
console.log("voting against player 5");
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 7));
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 8));
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 9));
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 10));
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 1));
stateApp.next(gameId);
console.log("voting against player 3");
stateApp.next(gameId);
console.log("voting against player 1");
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 2));
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 3));
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 4));
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 5));
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 6));
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
console.log("split, voting against player 5");
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 7));
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 8));
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 9));
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 10));
stateApp.vote(gameId, stateApp.getPlayerId(gameId, 1));
stateApp.next(gameId);
stateApp.next(gameId);
stateApp.next(gameId);
