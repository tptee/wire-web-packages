/*
 * Wire
 * Copyright (C) 2018 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

import {error as StoreEngineError} from '@wireapp/store-engine';
import {FileEngine} from '@wireapp/store-engine/dist/commonjs/engine';
import * as logdown from 'logdown';
import * as path from 'path';

import {SubscriberOptions} from './interfaces';

const defaultStorePath = path.join(__dirname, '.temp');

class StoreService {
  private readonly STORE_PATH: string;
  private readonly TABLE_NAME = 'subscribers';
  private readonly logger: logdown.Logger;
  private readonly storeEngine: FileEngine;

  constructor(storePath?: string) {
    this.STORE_PATH = storePath ? path.resolve(storePath) : defaultStorePath;
    this.storeEngine = new FileEngine(this.STORE_PATH);

    this.logger = logdown('@wireapp/travis-status-bot/StoreService', {
      logger: console,
      markdown: false,
    });
    this.logger.state.isEnabled = true;
  }

  public async addSubscriber(subscriberId: string): Promise<void> {
    await this.storeEngine.updateOrCreate(this.TABLE_NAME, subscriberId, {isSubscribed: true});
  }

  public async init(): Promise<void> {
    await this.storeEngine.init('travis-status-bot', {
      fileExtension: '.dat',
    });
  }

  public async checkSubscription(conversationId: string): Promise<boolean> {
    try {
      const {isSubscribed} = await this.storeEngine.read<SubscriberOptions>(this.TABLE_NAME, conversationId);
      return isSubscribed;
    } catch (error) {
      const recordNotFound =
        error instanceof StoreEngineError.RecordNotFoundError ||
        error.constructor.name !== StoreEngineError.RecordNotFoundError.name;
      if (!recordNotFound) {
        this.logger.error(error);
      }
      return false;
    }
  }

  public async getSubscribers(): Promise<string[]> {
    const conversationIds = await this.storeEngine.readAllPrimaryKeys(this.TABLE_NAME);
    const subscriberIds = [];

    for (const conversationId of conversationIds) {
      const isSubscribed = await this.checkSubscription(conversationId);
      if (isSubscribed) {
        subscriberIds.push(conversationId);
      }
    }

    return subscriberIds;
  }

  public async removeSubscriber(conversationId: string): Promise<void> {
    await this.storeEngine.updateOrCreate(this.TABLE_NAME, conversationId, {isSubscribed: false});
  }
}

export {StoreService};
