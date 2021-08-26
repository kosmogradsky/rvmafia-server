import { Observable } from "rxjs";

interface MapperWithStateReturnee<TState, TOutcomingMessage> {
  nextState: TState | undefined;
  nextMessage: TOutcomingMessage | undefined;
}

interface MapperWithState<TState, TIncomingMessage, TOutcomingMessage> {
  (state: TState, message: TIncomingMessage): MapperWithStateReturnee<
    TState,
    TOutcomingMessage
  >;
}

export function mapWithState<TState, TIncomingMessage, TOutcomingMessage>(
  mapper: MapperWithState<TState, TIncomingMessage, TOutcomingMessage>,
  initialState: TState
) {
  return (
    source: Observable<TIncomingMessage>
  ): Observable<TOutcomingMessage> => {
    let state: TState = initialState;

    return new Observable<TOutcomingMessage>((subscriber) => {
      const subscription = source.subscribe({
        next(message) {
          const { nextState, nextMessage } = mapper(state, message);

          if (nextState !== undefined) {
            state = nextState;
          }

          if (nextMessage !== undefined) {
            subscriber.next(nextMessage);
          }
        },
        error(err) {
          subscriber.error(err);
        },
        complete() {
          subscriber.complete();
        },
      });

      return () => {
        subscription.unsubscribe();
      };
    });
  };
}
