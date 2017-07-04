import * as EventEmitter from 'event-emitter';
import { SyncClient } from 'twilio-sync';

import { SYNC_NAMES } from '../../shared/consts';

let instance;

export default class OrderService /* extends EventEmitter */ {
  static shared() {
    instance = instance || new OrderService();
    return instance;
  }

  constructor() {
    this.client = undefined;
    this.orders = undefined;
    this.ordersList = undefined;
  }

  getOrders() {
    if (this.orders) {
      return Promise.resolve(orders);
    }
    return this.fetchOrders();
  }

  init() {
    return fetch('/api/token', { credentials: 'include' })
      .then(resp => resp.json())
      .then(({ token }) => {
        this.client = new SyncClient(token);
        return this.client.list(SYNC_NAMES.ORDER_QUEUE);
      })
      .then(list => {
        this.ordersList = list;
        this.addEventListeners();
        return this.fetchOrders();
      });
  }

  convertItemToOrder(item) {
    const order = { ...item.value };
    order.number = item.index;
    order.changeStatus = status => {
      this.changeStatus(order, status);
    };
    return order;
  }

  changeStatus(order, status) {
    const idx = this.orders.find(item => item.number === order.number);
    this.orders[idx] = { ...order, status };
    this.emit('updated', { orders: this.orders });
    return this.ordersList.update(order.number, { status });
  }

  addEventListeners() {
    this.ordersList.on('itemAdded', item => {
      this.orders.push(this.convertItemToOrder(item));
      this.emit('updated', { orders: this.orders });
    });

    this.ordersList.on('itemUpdated', item => {
      const idx = this.orders.find(
        existingItem => item.index === existingItem.number
      );
      this.orders[idx] = this.convertItemToOrder(item);
      this.emit('updated', { orders: this.orders });
    });

    this.ordersList.on('itemRemoved', item => {
      const idx = this.orders.find(
        existingItem => item.index === existingItem.number
      );

      this.orders.splice(idx, 1);
      this.emit('updated', { orders: this.orders });
    });
  }

  fetchOrders() {
    return this.ordersList.getItems({ pageSize: 1000 }).then(page => {
      this.orders = page.items.map(item => this.convertItemToOrder(item));
      return this.orders;
    });
  }
}

EventEmitter(OrderService.prototype);