import { QueueEntry } from "./QueueEntry";

export interface QueueStateEvent {
  type: "QueueStateEvent";
  state: Map<string, QueueEntry>;
}

export type StateEvent = QueueStateEvent;
