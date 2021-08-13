export interface QueueEntryAdded {
  type: "QueueEntryAdded";
  userId: string;
}

export interface QueueEntryRemoved {
  type: "QueueEntryRemoved";
  userId: string;
}

export interface QueueLengthUpdated {
  type: "QueueLengthUpdated";
  updatedLength: number;
}

export type StateEvent =
  | QueueEntryAdded
  | QueueEntryRemoved
  | QueueLengthUpdated;
