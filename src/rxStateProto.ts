import { Observable } from "rxjs";
import { scan } from "rxjs/operators";
import { ChangeStateRequest } from "./ChangeStateRequest";

export class QueueEntry {
  readonly orderToken: number;
  readonly orderTokenRange: number;

  constructor(orderTokenRange: number = 1024) {
    this.orderToken = Math.ceil(Math.random() * orderTokenRange);
    this.orderTokenRange = orderTokenRange;
  }
}

export function rxStateProto(incoming$: Observable<ChangeStateRequest>) {
  return incoming$.pipe(
    scan((acc, message): Map<string, QueueEntry> => {
      switch (message.type) {
        case "AddQueueEntry": {
          const nextAcc = new Map(acc);
          nextAcc.set(message.userId, new QueueEntry());

          return nextAcc;
        }
        case "RemoveQueueEntry": {
          const nextAcc = new Map(acc);
          nextAcc.delete(message.userId);

          return nextAcc;
        }
      }
    }, new Map<string, QueueEntry>())
  );
}
