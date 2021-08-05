import { Observable } from "rxjs";
import { scan } from "rxjs/operators";
import { ChangeStateRequest } from "./ChangeStateRequest";
import { QueueEntry } from "./QueueEntry";
import { QueueStateEvent, StateEvent } from "./StateEvent";

export function rxStateProto(
  incoming$: Observable<ChangeStateRequest>
): Observable<StateEvent> {
  return incoming$.pipe(
    scan(
      (acc, message): QueueStateEvent => {
        switch (message.type) {
          case "AddQueueEntry": {
            const nextState = new Map(acc.state);
            nextState.set(message.userId, new QueueEntry());

            return {
              type: "QueueStateEvent",
              state: nextState,
            };
          }
          case "RemoveQueueEntry": {
            const nextState = new Map(acc.state);
            nextState.delete(message.userId);

            return {
              type: "QueueStateEvent",
              state: nextState,
            };
          }
        }
      },
      { type: "QueueStateEvent", state: new Map<string, QueueEntry>() }
    )
  );
}
