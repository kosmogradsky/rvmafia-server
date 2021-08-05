export class QueueEntry {
  readonly orderToken: number;
  readonly orderTokenRange: number;

  constructor(orderTokenRange: number = 1024) {
    this.orderToken = Math.ceil(Math.random() * orderTokenRange);
    this.orderTokenRange = orderTokenRange;
  }
}
