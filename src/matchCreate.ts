import * as admin from "firebase-admin";
import { between } from "./between";
import { Match, MatchPlayerIds } from "./Match";
import { queueSubject } from "./queueSubject";

const matches = new Map<string, Match>();

interface CreateMatchDocResult {
  matchPlayerIds: MatchPlayerIds;
  matchId: string;
}

const createMatchDoc = async (
  transaction: admin.firestore.Transaction
): Promise<CreateMatchDocResult> => {
  const playersQueueEntries = Array.from(queueSubject.getValue().entries())
    .sort((entryA, entryB) => entryA[1].orderToken - entryB[1].orderToken)
    .slice(0, 10);

  const matchPlayerIds = {
    first: { playerId: playersQueueEntries[0]![0] },
    second: { playerId: playersQueueEntries[1]![0] },
    third: { playerId: playersQueueEntries[2]![0] },
    fourth: { playerId: playersQueueEntries[3]![0] },
    fifth: { playerId: playersQueueEntries[4]![0] },
    sixth: { playerId: playersQueueEntries[5]![0] },
    seventh: { playerId: playersQueueEntries[6]![0] },
    eighth: { playerId: playersQueueEntries[7]![0] },
    ninth: { playerId: playersQueueEntries[8]![0] },
    tenth: { playerId: playersQueueEntries[9]![0] },
  };

  for (const playerQueueEntry of playersQueueEntries) {
    const queue = queueSubject.getValue();
    const nextQueue = new Map(queue);

    nextQueue.delete(playerQueueEntry[0]);
    nextQueue.set(
      db.collection("players").doc(playerQueueEntry.id),
      { inMatch: matchRef.id },
      { merge: true }
    );
  }

  transaction.set(
    db.collection("general").doc("general"),
    {
      playersInQueueCount: admin.firestore.FieldValue.increment(-10),
    },
    { merge: true }
  );

  return {
    matchId: matchRef.id,
    matchPlayerIds: {
      playerOne: matchDoc.first.playerId,
      playerTwo: matchDoc.second.playerId,
      playerThree: matchDoc.third.playerId,
      playerFour: matchDoc.fourth.playerId,
      playerFive: matchDoc.fifth.playerId,
      playerSix: matchDoc.sixth.playerId,
      playerSeven: matchDoc.seventh.playerId,
      playerEight: matchDoc.eighth.playerId,
      playerNine: matchDoc.ninth.playerId,
      playerTen: matchDoc.tenth.playerId,
    },
  };
};

const promoteQueueEntries = async (
  transaction: admin.firestore.Transaction
): Promise<null> => {
  const db = admin.firestore();
  const allQueueEntriesRef = db.collection("queueEntries");
  const allQueueEntries = await transaction.get(allQueueEntriesRef);

  for (const queueEntrySnapshot of allQueueEntries.docs) {
    const queueEntry = queueEntrySnapshot.data();
    const nextOrderTokenRange = queueEntry.orderTokenRange / 2;
    const integerOrderTokenRange =
      nextOrderTokenRange >= 1 ? nextOrderTokenRange : 1;

    transaction.set(
      queueEntrySnapshot.ref,
      {
        orderToken: between(1, integerOrderTokenRange),
        orderTokenRange: integerOrderTokenRange,
      },
      { merge: true }
    );
  }

  return null;
};

const createMatchIfEnoughPlayers = () => {
  const currentPlayersInQueueCount = queueSubject.getValue().size;

  if (currentPlayersInQueueCount >= 10) {
    return createMatchDoc(transaction);
  } else {
    return promoteQueueEntries(transaction);
  }
};

const createMatchIfEnoughPlayers = async () => {
  const result = await createMatchDocIfEnoughPlayers();

  if (result === null) {
    return;
  }

  const match = new Match(result.matchPlayerIds, {
    onPhaseChange(phase) {
      admin
        .firestore()
        .collection("matchPhases")
        .doc(result.matchId)
        .set(phase);
    },
  });

  matches.set(result.matchId, match);
};
