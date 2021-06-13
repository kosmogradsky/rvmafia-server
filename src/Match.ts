import * as Pusher from "pusher";
import { getNextPlayerPosition, PlayerPosition } from "./PlayerPosition";

export const pusher = new Pusher({
  appId: "1152587",
  key: "e653a5e7be4cca671bb7",
  secret: "a5bd95af214e332fde76",
  cluster: "eu",
  useTLS: true,
});

type PlayerRole = "civilian" | "sheriff" | "mafia" | "godfather";

type MatchRoles = {
  [position in PlayerPosition]: PlayerRole;
};

const roles: MatchRoles = {
  playerOne: "sheriff",
  playerTwo: "civilian",
  playerThree: "civilian",
  playerFour: "civilian",
  playerFive: "civilian",
  playerSix: "civilian",
  playerSeven: "civilian",
  playerEight: "godfather",
  playerNine: "mafia",
  playerTen: "mafia",
};

const createShuffledRoles = (): MatchRoles => {
  const output: MatchRoles = { ...roles };

  for (
    let playerCurrentNumber = 9;
    playerCurrentNumber > 0;
    playerCurrentNumber--
  ) {
    const playerNextNumber = Math.floor(
      Math.random() * (playerCurrentNumber + 1)
    );
    const playerNextPosition = numberToPlayerPosition(playerNextNumber);
    const playerCurrentPosition = numberToPlayerPosition(playerCurrentNumber);
    const temp = output[playerCurrentPosition];
    output[playerCurrentPosition] = output[playerNextPosition];
    output[playerNextPosition] = temp;
  }

  return output;
};

const numberToPlayerPosition = (num: number): PlayerPosition => {
  switch (num) {
    case 1:
      return "playerOne";
    case 2:
      return "playerTwo";
    case 3:
      return "playerThree";
    case 4:
      return "playerFour";
    case 5:
      return "playerFive";
    case 6:
      return "playerSix";
    case 7:
      return "playerSeven";
    case 8:
      return "playerEight";
    case 9:
      return "playerNine";
    case 10:
      return "playerTen";
    default:
      throw new Error("Cannot convert this number to PlayerPosition.");
  }
};

const getFirstItemIfAllItemsAreEqual = <T>(arr: T[]): T | null => {
  const firstItem = arr[0];

  if (firstItem === undefined) {
    return null;
  }

  if (arr.every((item) => item === firstItem)) {
    return firstItem;
  }

  return null;
};

class MatchPlayer {
  hasSelectedRole: boolean = false;
  isAlive: boolean = true;
  fouls: 0 | 1 | 2 | 3 = 0;

  constructor(readonly userId: string, public role: PlayerRole) {}
}

interface MatchTable {
  playerOne: MatchPlayer;
  playerTwo: MatchPlayer;
  playerThree: MatchPlayer;
  playerFour: MatchPlayer;
  playerFive: MatchPlayer;
  playerSix: MatchPlayer;
  playerSeven: MatchPlayer;
  playerEight: MatchPlayer;
  playerNine: MatchPlayer;
  playerTen: MatchPlayer;
}

export interface MatchPlayerIds {
  playerOne: string;
  playerTwo: string;
  playerThree: string;
  playerFour: string;
  playerFive: string;
  playerSix: string;
  playerSeven: string;
  playerEight: string;
  playerNine: string;
  playerTen: string;
}

function* iterateMatchTable(matchTable: MatchTable) {
  yield matchTable.playerOne;
  yield matchTable.playerTwo;
  yield matchTable.playerThree;
  yield matchTable.playerFour;
  yield matchTable.playerFive;
  yield matchTable.playerSix;
  yield matchTable.playerSeven;
  yield matchTable.playerEight;
  yield matchTable.playerNine;
  yield matchTable.playerTen;
}

type MatchPhase =
  | PlayerPicksCard
  | NormalDelay
  | ContractNight
  | Day
  | VotingAnnounced
  | VotingAgainstPlayer
  | MafiaShoots
  | GodfatherReveals
  | SheriffReveals
  | VictimAnnounced
  | VictimThinks
  | VictimSpeaks
  | ShotMissAnnounced
  | ExileAnnounced
  | ExileSpeaks
  | SplitAnnounced
  | SpliteeSpeaks
  | VotingAgainstSplitees;

interface PlayerPicksCard {
  type: "PlayerPicksCard";
  whoPicks: PlayerPosition;
  duration: number;
}

const createPlayerPicksCard = (whoPicks: PlayerPosition): PlayerPicksCard => ({
  type: "PlayerPicksCard",
  whoPicks,
  duration: 5000,
});

interface NormalDelay {
  type: "NormalDelay";
  duration: number;
  nextPhase: MatchPhase;
}

const createNormalDelay = (nextPhase: MatchPhase): NormalDelay => ({
  type: "NormalDelay",
  duration: 3000,
  nextPhase,
});

interface ContractNight {
  type: "ContractNight";
  duration: number;
}

const createContractNight = (): ContractNight => ({
  type: "ContractNight",
  duration: 60000,
});

interface Day {
  type: "Day";
  whoSpeaks: PlayerPosition;
  duration: number;
}

const createDay = (whoSpeaks: PlayerPosition): Day => ({
  type: "Day",
  duration: 60000,
  whoSpeaks,
});

interface VotingAnnounced {
  type: "VotingAnnounced";
  nominationsInAscTimeOrder: Nomination[];
  duration: number;
  isAfterSplit: boolean;
}

const createVotingAnnounced = (
  nominationsInAscTimeOrder: Nomination[],
  { isAfterSplit }: { isAfterSplit: boolean }
): VotingAnnounced => {
  return {
    type: "VotingAnnounced",
    duration: 5000,
    nominationsInAscTimeOrder,
    isAfterSplit,
  };
};

interface VotingAgainstPlayer {
  type: "VotingAgainstPlayer";
  nomination: Nomination;
  nextNominations: Nomination[];
  duration: number;
  isAfterSplit: boolean;
}

const createVotingAgainstPlayer = (
  nomination: Nomination,
  nextNominations: Nomination[],
  { isAfterSplit }: { isAfterSplit: boolean }
): VotingAgainstPlayer => ({
  type: "VotingAgainstPlayer",
  duration: 4000,
  nomination,
  nextNominations,
  isAfterSplit,
});

interface MafiaShoots {
  type: "MafiaShoots";
  duration: number;
}

const createMafiaShoots = (): MafiaShoots => ({
  type: "MafiaShoots",
  duration: 5000,
});

interface GodfatherReveals {
  type: "GodfatherReveals";
  duration: number;
}

const createGodfatherReveals = (): GodfatherReveals => ({
  type: "GodfatherReveals",
  duration: 5000,
});

interface SheriffReveals {
  type: "SheriffReveals";
  duration: number;
}

const createSheriffReveals = (): SheriffReveals => ({
  type: "SheriffReveals",
  duration: 5000,
});

interface VictimAnnounced {
  type: "VictimAnnounced";
  victim: PlayerPosition;
  duration: number;
}

const createVictimAnnounced = (victim: PlayerPosition): VictimAnnounced => ({
  type: "VictimAnnounced",
  victim,
  duration: 3000,
});

interface VictimThinks {
  type: "VictimThinks";
  victim: PlayerPosition;
  duration: number;
}

const createVictimThinks = (victim: PlayerPosition): VictimThinks => ({
  type: "VictimThinks",
  victim,
  duration: 20000,
});

interface VictimSpeaks {
  type: "VictimSpeaks";
  victim: PlayerPosition;
  duration: number;
}

const createVictimSpeaks = (victim: PlayerPosition): VictimSpeaks => ({
  type: "VictimSpeaks",
  victim,
  duration: 60000,
});

interface ShotMissAnnounced {
  type: "ShotMissAnnounced";
  duration: number;
}

const createShotMissAnnounced = (): ShotMissAnnounced => ({
  type: "ShotMissAnnounced",
  duration: 3000,
});

interface ExileAnnounced {
  type: "ExileAnnounced";
  exile: PlayerPosition;
  duration: number;
}

const createExileAnnounced = (exile: PlayerPosition): ExileAnnounced => ({
  type: "ExileAnnounced",
  exile,
  duration: 3000,
});

interface ExileSpeaks {
  type: "ExileSpeaks";
  exile: PlayerPosition;
  nextExiles: PlayerPosition[];
  duration: number;
}

const createExileSpeaks = (
  exile: PlayerPosition,
  nextExiles: PlayerPosition[]
): ExileSpeaks => ({
  type: "ExileSpeaks",
  exile,
  nextExiles,
  duration: 60000,
});

interface SplitAnnounced {
  type: "SplitAnnounced";
  splitees: Nomination[];
  duration: number;
}

const createSplitAnnounced = (splitees: Nomination[]): SplitAnnounced => ({
  type: "SplitAnnounced",
  splitees,
  duration: 3000,
});

interface SpliteeSpeaks {
  type: "SpliteeSpeaks";
  splitee: Nomination;
  nextSplitees: Nomination[];
  spliteesOriginally: Nomination[];
  duration: number;
}

const createSpliteeSpeaks = (
  splitee: Nomination,
  nextSplitees: Nomination[],
  spliteesOriginally: Nomination[]
): SpliteeSpeaks => ({
  type: "SpliteeSpeaks",
  splitee,
  nextSplitees,
  spliteesOriginally,
  duration: 3000,
});

interface VotingAgainstSplitees {
  type: "VotingAgainstSplitees";
  splitees: Nomination[];
  duration: number;
}

const createVotingAgainstSplitees = (
  splitees: Nomination[]
): VotingAgainstSplitees => ({
  type: "VotingAgainstSplitees",
  splitees,
  duration: 3000,
});

interface Nomination {
  nominee: PlayerPosition;
  nominatedWhen: number;
}

interface VoteAgainstPlayer {
  nomination: Nomination;
  votedWhen: number;
}

interface VoteAgainstSplitees {
  votedWhen: number;
}

interface Shot {
  victim: PlayerPosition;
  shotWhen: number;
}

interface Supportion {
  nominee: PlayerPosition;
  supportedWhen: number;
}

interface MatchListeners {
  onPhaseChange(phase: MatchPhase): void;
}

class Round {
  nominations: Map<PlayerPosition, Nomination> = new Map();
  supportions: Map<PlayerPosition, Supportion> = new Map();
  shots: Map<PlayerPosition, Shot> = new Map();
  votesAgainstPlayer: Map<PlayerPosition, VoteAgainstPlayer> = new Map();
  votesAgainstSplitees: Map<PlayerPosition, VoteAgainstSplitees> = new Map();

  constructor(readonly openedBy: PlayerPosition) {}
}

export class Match {
  readonly matchTable: MatchTable;
  phase: MatchPhase = createPlayerPicksCard("playerOne");
  round = new Round("playerOne");
  currentRound: number = 0;

  constructor(ids: MatchPlayerIds, private readonly listeners: MatchListeners) {
    const roles = createShuffledRoles();
    this.matchTable = {
      playerOne: new MatchPlayer(ids.playerOne, roles.playerOne),
      playerTwo: new MatchPlayer(ids.playerTwo, roles.playerTwo),
      playerThree: new MatchPlayer(ids.playerThree, roles.playerThree),
      playerFour: new MatchPlayer(ids.playerFour, roles.playerFour),
      playerFive: new MatchPlayer(ids.playerFive, roles.playerFive),
      playerSix: new MatchPlayer(ids.playerSix, roles.playerSix),
      playerSeven: new MatchPlayer(ids.playerSeven, roles.playerSeven),
      playerEight: new MatchPlayer(ids.playerEight, roles.playerEight),
      playerNine: new MatchPlayer(ids.playerNine, roles.playerNine),
      playerTen: new MatchPlayer(ids.playerTen, roles.playerTen),
    };
  }

  createAfterCurrentPhase(): () => void {
    switch (this.phase.type) {
      case "PlayerPicksCard":
        return this.afterPlayerPicksCard(this.phase);
      case "NormalDelay":
        return this.afterNormalDelay(this.phase);
      case "ContractNight":
        return this.afterContractNight();
      case "Day":
        return this.afterDay(this.phase);
      case "MafiaShoots":
        return this.afterMafiaShoots();
      case "GodfatherReveals":
        return this.afterGodfatherReveals();
      case "SheriffReveals":
        return this.afterSheriffReveals();
      case "VictimAnnounced":
        return this.afterVictimAnnounced(this.phase);
      case "VictimThinks":
        return this.afterVictimThinks(this.phase);
      case "VotingAnnounced":
        return this.afterVotingAnnounced(this.phase);
      case "VotingAgainstPlayer":
        return this.afterVotingAgainstPlayer(this.phase);
      case "VictimSpeaks":
      case "ShotMissAnnounced":
        return this.openNextRound();
      case "ExileAnnounced":
        return this.afterExileAnnounced(this.phase);
      case "SplitAnnounced":
        return this.afterSplitAnnounced(this.phase);
      case "SpliteeSpeaks":
        return this.afterSpliteeSpeaks(this.phase);
      case "VotingAgainstSplitees":
        return this.afterVotingAgainstSplitees(this.phase);
      case "ExileSpeaks":
        return this.afterExileSpeaks(this.phase);
    }
  }

  start() {
    this.listeners.onPhaseChange(this.phase);
  }

  setPhase(phase: MatchPhase) {
    this.phase = phase;
    this.listeners.onPhaseChange(this.phase);
  }

  afterPlayerPicksCard(phase: PlayerPicksCard) {
    return () => {
      this.matchTable[phase.whoPicks].hasSelectedRole = true;

      if (phase.whoPicks === "playerTen") {
        this.phase = createNormalDelay(createContractNight());
      } else {
        this.phase = createPlayerPicksCard(
          getNextPlayerPosition(phase.whoPicks)
        );
      }
    };
  }

  afterNormalDelay(phase: NormalDelay) {
    return () => {
      this.phase = phase.nextPhase;
    };
  }

  afterContractNight() {
    return () => {
      this.phase = createNormalDelay(createDay(this.round.openedBy));
    };
  }

  afterDay(phase: Day) {
    return () => {
      const nextSpeakerPosition = getNextPlayerPosition(phase.whoSpeaks);

      if (nextSpeakerPosition === this.round.openedBy) {
        if (this.round.nominations.size > 0) {
          const nominationsInAscTimeOrder = Array.from(
            this.round.nominations.entries()
          )
            .sort((entryA, entryB) => {
              const aNominatedWhen = entryA[1].nominatedWhen;
              const bNominatedWhen = entryB[1].nominatedWhen;

              return aNominatedWhen - bNominatedWhen;
            })
            .map((entry) => entry[1]);

          this.phase = createVotingAnnounced(nominationsInAscTimeOrder, {
            isAfterSplit: false,
          });
        } else {
          this.phase = createNormalDelay(createMafiaShoots());
        }
      } else {
        this.phase = createDay(nextSpeakerPosition);
      }
    };
  }

  afterMafiaShoots() {
    return () => {
      this.phase = createGodfatherReveals();
    };
  }

  afterGodfatherReveals() {
    return () => {
      this.phase = createSheriffReveals();
    };
  }

  afterSheriffReveals() {
    return () => {
      const victim = this.getVictimOfCurrentRound();
      if (victim !== null) {
        this.phase = createNormalDelay(createVictimAnnounced(victim));
      } else {
        this.phase = createNormalDelay(createShotMissAnnounced());
      }
    };
  }

  afterVictimAnnounced(phase: VictimAnnounced) {
    return () => {
      if (this.currentRound === 0) {
        this.phase = createVictimThinks(phase.victim);
      } else {
        this.phase = createVictimSpeaks(phase.victim);
      }
    };
  }

  afterVictimThinks(phase: VictimThinks) {
    return () => {
      this.phase = createVictimSpeaks(phase.victim);
    };
  }

  openNextRound() {
    return () => {
      const nextRoundOpenedBy = this.getNextAlivePlayerPosition(
        this.round.openedBy
      );
      this.phase = createNormalDelay(createDay(nextRoundOpenedBy));
      this.currentRound++;
      this.round = new Round(nextRoundOpenedBy);
    };
  }

  getFirstAlivePlayer() {
    for (const player of iterateMatchTable(this.matchTable)) {
      if (player.isAlive) {
        return player;
      }
    }

    return undefined;
  }

  getNextAlivePlayerPosition(playerPosition: PlayerPosition): PlayerPosition {
    let nextAlivePlayerPosition = getNextPlayerPosition(playerPosition);

    while (this.matchTable[nextAlivePlayerPosition].isAlive === false) {
      nextAlivePlayerPosition = getNextPlayerPosition(playerPosition);
    }

    return nextAlivePlayerPosition;
  }

  afterVotingAnnounced(phase: VotingAnnounced) {
    return () => {
      const nextNominations = phase.nominationsInAscTimeOrder.slice();
      const currentNomination = nextNominations.shift();

      if (currentNomination === undefined) {
        throw new Error(
          "currentNomination is undefined after VotingAnnounced state"
        );
      }

      this.phase = createVotingAgainstPlayer(
        currentNomination,
        nextNominations,
        { isAfterSplit: phase.isAfterSplit }
      );
    };
  }

  afterVotingAgainstPlayer(phase: VotingAgainstPlayer) {
    return () => {
      const nextNominations = phase.nextNominations.slice();
      const nomination = nextNominations.shift();

      if (nomination === undefined) {
        const exiles = this.getExilesOfCurrentRound(phase.nomination);

        if (exiles.length > 1) {
          if (phase.isAfterSplit) {
            this.phase = createVotingAgainstSplitees(exiles);
          } else {
            this.phase = createSplitAnnounced(exiles);
          }
        } else {
          const exile = exiles.shift();

          if (exile === undefined) {
            throw new Error("exiles array must be non-empty");
          }

          this.phase = createExileAnnounced(exile.nominee);
        }
      } else {
        this.phase = createVotingAgainstPlayer(nomination, nextNominations, {
          isAfterSplit: phase.isAfterSplit,
        });
      }
    };
  }

  afterExileAnnounced(phase: ExileAnnounced) {
    return () => {
      this.phase = createExileSpeaks(phase.exile, []);
    };
  }

  afterSplitAnnounced(phase: SplitAnnounced) {
    return () => {
      const nextSplitees = phase.splitees.slice();
      const currentSplitee = phase.splitees.shift();

      if (currentSplitee === undefined) {
        throw new Error(
          "currentSplitee is undefined after SplitAnnounced state"
        );
      }

      this.phase = createSpliteeSpeaks(
        currentSplitee,
        nextSplitees,
        phase.splitees
      );
    };
  }

  afterSpliteeSpeaks(phase: SpliteeSpeaks) {
    return () => {
      const nextSplitees = phase.nextSplitees.slice();
      const currentSplitee = nextSplitees.shift();

      if (currentSplitee === undefined) {
        this.phase = createVotingAnnounced(phase.spliteesOriginally, {
          isAfterSplit: true,
        });
      } else {
        this.phase = createSpliteeSpeaks(
          currentSplitee,
          nextSplitees,
          phase.spliteesOriginally
        );
      }
    };
  }

  afterVotingAgainstSplitees(phase: VotingAgainstSplitees) {
    return () => {
      let alivePlayersCount = 0;
      for (const player of iterateMatchTable(this.matchTable)) {
        if (player.isAlive) {
          alivePlayersCount++;
        }
      }

      if (this.round.votesAgainstSplitees.size > alivePlayersCount / 2) {
        const nextExiles = phase.splitees.map((splitee) => splitee.nominee);
        const currentExile = nextExiles.shift();

        if (currentExile === undefined) {
          throw new Error(
            "currentExile is undefined after VotingAgainstSplitees state"
          );
        }

        this.phase = createExileSpeaks(currentExile, nextExiles);
      } else {
        this.phase = createNormalDelay(createMafiaShoots());
      }
    };
  }

  afterExileSpeaks(phase: ExileSpeaks) {
    return () => {
      const nextExiles = phase.nextExiles.slice();
      const currentExile = nextExiles.shift();

      if (currentExile === undefined) {
        this.phase = createNormalDelay(createMafiaShoots());
      } else {
        this.phase = createExileSpeaks(currentExile, nextExiles);
      }
    };
  }

  nominateForVote(whoNominates: PlayerPosition, nominee: PlayerPosition) {
    const nominationFromThisNominator =
      this.round.nominations.get(whoNominates);

    if (
      nominationFromThisNominator !== undefined ||
      this.phase.type !== "Day" ||
      this.phase.whoSpeaks !== whoNominates
    ) {
      return;
    }

    const isThisNomineeAlreadyNominated = Array.from(
      this.round.nominations.values()
    ).some((nomination) => nomination.nominee === nominee);

    if (isThisNomineeAlreadyNominated) {
      this.round.supportions.set(whoNominates, {
        nominee,
        supportedWhen: Date.now(),
      });
    } else {
      this.round.nominations.set(whoNominates, {
        nominee,
        nominatedWhen: Date.now(),
      });
    }
  }

  voteAgainstPlayer(whoVotes: PlayerPosition, againstWhom: PlayerPosition) {
    const existingVote = this.round.votesAgainstPlayer.get(whoVotes);

    if (
      existingVote === undefined &&
      this.phase.type === "VotingAgainstPlayer" &&
      this.phase.nomination.nominee === againstWhom
    ) {
      this.round.votesAgainstPlayer.set(whoVotes, {
        nomination: this.phase.nomination,
        votedWhen: Date.now(),
      });
    }
  }

  voteAgainstSplitees(whoVotes: PlayerPosition) {
    const existingVote = this.round.votesAgainstSplitees.get(whoVotes);

    if (
      existingVote === undefined &&
      this.phase.type === "VotingAgainstSplitees"
    ) {
      this.round.votesAgainstSplitees.set(whoVotes, {
        votedWhen: Date.now(),
      });
    }
  }

  shoot(killer: PlayerPosition, victim: PlayerPosition) {
    const existingShot = this.round.shots.get(killer);

    if (
      existingShot === undefined &&
      this.phase.type === "MafiaShoots" &&
      (this.matchTable[killer].role === "mafia" ||
        this.matchTable[killer].role === "godfather")
    ) {
      this.round.shots.set(killer, { victim, shotWhen: Date.now() });
    }
  }

  swapRoles(whoSwaps: PlayerPosition, withWhom: PlayerPosition) {
    const playerWhoSwaps = this.matchTable[whoSwaps];
    const playerWithWhom = this.matchTable[withWhom];

    if (
      playerWithWhom.hasSelectedRole ||
      playerWhoSwaps.hasSelectedRole ||
      this.phase.type !== "PlayerPicksCard" ||
      this.phase.whoPicks !== whoSwaps
    ) {
      return;
    }

    const playerWhoSwapsRole = playerWhoSwaps.role;
    playerWhoSwaps.role = playerWithWhom.role;
    playerWithWhom.role = playerWhoSwapsRole;
  }

  getAliveMafiaCount(): number {
    let count = 0;

    for (const player of iterateMatchTable(this.matchTable)) {
      if (
        player.isAlive &&
        (player.role === "godfather" || player.role === "mafia")
      ) {
        count++;
      }
    }

    return count;
  }

  getVictimOfCurrentRound(): PlayerPosition | null {
    const shots: PlayerPosition[] = [];

    for (const shot of this.round.shots.entries()) {
      const killer = this.matchTable[shot[0]];

      if (killer.role === "godfather" || killer.role === "mafia") {
        shots.push(shot[1].victim);
      }
    }

    if (shots.length !== this.getAliveMafiaCount()) {
      return null;
    }

    return getFirstItemIfAllItemsAreEqual(shots);
  }

  getExilesOfCurrentRound(lastNomination: Nomination): Nomination[] {
    const votesAgainstLastNomination = { howMany: 10 };
    const votesByNomination: Map<Nomination, { howMany: number }> = new Map();
    votesByNomination.set(lastNomination, votesAgainstLastNomination);

    for (const vote of this.round.votesAgainstPlayer.entries()) {
      const currentNomination = vote[1].nomination;

      if (currentNomination === lastNomination) {
        continue;
      }

      votesAgainstLastNomination.howMany--;
      const votesAgainstCurrentNomination =
        votesByNomination.get(currentNomination);

      if (votesAgainstCurrentNomination === undefined) {
        votesByNomination.set(currentNomination, { howMany: 1 });
      } else {
        votesAgainstCurrentNomination.howMany++;
      }
    }

    const nominationsByHowManyVotes = new Map<number, Nomination[]>();

    for (const votesAgainstNomination of votesByNomination.entries()) {
      const existingNominationsArr = nominationsByHowManyVotes.get(
        votesAgainstNomination[1].howMany
      );

      if (existingNominationsArr === undefined) {
        nominationsByHowManyVotes.set(votesAgainstNomination[1].howMany, [
          votesAgainstNomination[0],
        ]);
      } else {
        existingNominationsArr.push(votesAgainstNomination[0]);
      }
    }

    const greatestVotesCount = Math.max(...nominationsByHowManyVotes.keys());
    const exiles = nominationsByHowManyVotes.get(greatestVotesCount);

    if (exiles === undefined) {
      throw new Error(
        "exiles is undefined when accessing by greatestVotesCount"
      );
    }

    exiles.sort((exileA, exileB) => {
      const aNominatedWhen = exileA.nominatedWhen;
      const bNominatedWhen = exileB.nominatedWhen;

      return aNominatedWhen - bNominatedWhen;
    });

    return exiles;
  }
}
