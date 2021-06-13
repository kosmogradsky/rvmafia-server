import * as express from "express";
import * as admin from "firebase-admin";
import { between } from "./between";
import { Match, MatchPlayerIds } from "./Match";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const app = express();
const matches = new Map<string, Match>();

interface CreateMatchDocResult {
  matchPlayerIds: MatchPlayerIds;
  matchId: string;
}

const createMatchDoc = async (
  transaction: admin.firestore.Transaction
): Promise<CreateMatchDocResult> => {
  const db = admin.firestore();
  const playersQueueEntriesRef = db
    .collection("queueEntries")
    .orderBy("orderToken")
    .limit(10);
  const playersQueueEntries = await transaction.get(playersQueueEntriesRef);

  const matchRef = db.collection("matches").doc();
  const matchDoc = {
    first: { playerId: playersQueueEntries.docs[0]!.id },
    second: { playerId: playersQueueEntries.docs[1]!.id },
    third: { playerId: playersQueueEntries.docs[2]!.id },
    fourth: { playerId: playersQueueEntries.docs[3]!.id },
    fifth: { playerId: playersQueueEntries.docs[4]!.id },
    sixth: { playerId: playersQueueEntries.docs[5]!.id },
    seventh: { playerId: playersQueueEntries.docs[6]!.id },
    eighth: { playerId: playersQueueEntries.docs[7]!.id },
    ninth: { playerId: playersQueueEntries.docs[8]!.id },
    tenth: { playerId: playersQueueEntries.docs[9]!.id },
  };
  transaction.set(matchRef, matchDoc);

  for (const playerQueueEntry of playersQueueEntries.docs) {
    transaction.delete(playerQueueEntry.ref);
    transaction.set(
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

const createMatchDocIfEnoughPlayers = () => {
  const db = admin.firestore();
  return db.runTransaction(async (transaction) => {
    const generalRef = db.collection("general").doc("general");
    const generalSnapshot = await transaction.get(generalRef);
    const general = generalSnapshot.data();

    const currentPlayersInQueueCount: number =
      general?.playersInQueueCount ?? 0;

    if (currentPlayersInQueueCount >= 10) {
      return createMatchDoc(transaction);
    } else {
      return promoteQueueEntries(transaction);
    }
  });
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

app.post("/create-match", createMatchIfEnoughPlayers);
