export interface QueueingStatusUpdated {
  type: "QueueingStatusUpdated";
  userId: string;
  status: boolean;
}

export interface QueueLengthUpdated {
  type: "QueueLengthUpdated";
  updatedLength: number;
}

export interface GotQueueLength {
  type: 'GotQueueLength';
  requestId: string;
  updatedLength: number;
}

export type StateEvent =
  | QueueingStatusUpdated
  | QueueLengthUpdated
  | GotQueueLength;
