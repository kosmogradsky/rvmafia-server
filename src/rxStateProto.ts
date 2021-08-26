import { merge, Observable } from "rxjs";
import {
  filter,
  groupBy,
  map,
  mapTo,
  mergeMap,
  scan,
  share,
  startWith,
  takeUntil,
  withLatestFrom,
} from "rxjs/operators";
import {
  ChangeStateRequest,
  RemoveQueueEntry,
  AddQueueEntry,
  GetQueueLength,
  CreateIsQueueing,
  GetIsQueueing,
  DestroyIsQueueing,
} from "./ChangeStateRequest";
import {
  GotQueueLength,
  QueueEntryAdded,
  QueueEntryRemoved,
  QueueingStatusUpdated,
  QueueLengthUpdated,
  StateEvent,
} from "./StateEvent";

export function rxStateProto(
  incoming$: Observable<ChangeStateRequest>
): Observable<StateEvent> {
  const queueingStatusUpdated$ = incoming$.pipe(
    filter(
      (
        message
      ): message is
        | CreateIsQueueing
        | AddQueueEntry
        | RemoveQueueEntry
        | DestroyIsQueueing
        | GetIsQueueing =>
        message.type === "CreateIsQueueing" ||
        message.type === "AddQueueEntry" ||
        message.type === "RemoveQueueEntry" ||
        message.type === "DestroyIsQueueing" ||
        message.type === "GetIsQueueing"
    ),
    groupBy((message) => message.userId, {
      duration: (queueingStatusMessage$) =>
        queueingStatusMessage$.pipe(
          filter((message) => message.type === "DestroyIsQueueing")
        ),
    }),
    mergeMap((queueingStatusMessage$) => {
      const queueEntryAdded$ = queueingStatusMessage$.pipe(
        filter((message): message is AddQueueEntry => message.type === 'AddQueueEntry'),
        mapTo<QueueEntryAdded>({
          type: 'QueueEntryAdded',
          userId: queueingStatusMessage$.key
        })
      );

      const queueEntryRemoved$ = queueingStatusMessage$.pipe(
        filter((message): message is RemoveQueueEntry => message.type === 'RemoveQueueEntry'),
        mapTo<QueueEntryRemoved>({
          type: 'QueueEntryRemoved',
          userId: queueingStatusMessage$.key
        })
      );

      const isQueueing$ = queueingStatusMessage$.pipe(
        filter(
          (message): message is AddQueueEntry | RemoveQueueEntry =>
            message.type === "AddQueueEntry" ||
            message.type === "RemoveQueueEntry"
        ),
        scan((_, message) => {
          switch (message.type) {
            case "AddQueueEntry":
              return true;
            case "RemoveQueueEntry":
              return false;
          }
        }, false),
        startWith(false),
        share()
      );

      const queueingStatus$ = isQueueing$.pipe(
        map(
          (isQueueing): QueueingStatusUpdated => ({
            type: "QueueingStatusUpdated",
            userId: queueingStatusMessage$.key,
            status: isQueueing,
          })
        )
      );

      const queueingStatusOnRequest$ = incoming$.pipe(
        filter(
          (message): message is GetIsQueueing =>
            message.type === "GetIsQueueing"
        ),
        withLatestFrom(isQueueing$),
        map(
          ([_, isQueueing]): QueueingStatusUpdated => ({
            type: "QueueingStatusUpdated",
            userId: queueingStatusMessage$.key,
            status: isQueueing,
          })
        )
      );

      return merge(queueingStatus$, queueingStatusOnRequest$);
    })
  );

  const queueLengthInitialEvent: QueueLengthUpdated | GotQueueLength = {
    type: "QueueLengthUpdated",
    updatedLength: 0,
  };

  const queueLengthEvent$ = merge(
    queueingStatusUpdated$,
    incoming$.pipe(
      filter(
        (message): message is GetQueueLength =>
          message.type === "GetQueueLength"
      )
    )
  ).pipe(
    scan<
      GetQueueLength | QueueingStatusUpdated,
      QueueLengthUpdated | GotQueueLength
    >((prevEvent, lifecycleEvent): QueueLengthUpdated | GotQueueLength => {
      switch (lifecycleEvent.type) {
        case "QueueEntryAdded":
          return {
            type: "QueueLengthUpdated",
            updatedLength: prevEvent.updatedLength + 1,
          };
        case "QueueEntryRemoved":
          return {
            type: "QueueLengthUpdated",
            updatedLength: prevEvent.updatedLength - 1,
          };
        case "GetQueueLength":
          return {
            type: "GotQueueLength",
            requestId: lifecycleEvent.requestId,
            updatedLength: prevEvent.updatedLength,
          };
      }
    }, queueLengthInitialEvent)
  );

  return merge(queueEntryLifecycleEvent$, queueLengthEvent$);
}
