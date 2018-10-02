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

import {Connection, ConnectionStatus} from '@wireapp/api-client/dist/commonjs/connection';
import {MessageHandler} from '@wireapp/bot-api';
import {TextContent} from '@wireapp/core/dist/conversation/content';
import {PayloadBundleIncoming, PayloadBundleType, ReactionType} from '@wireapp/core/dist/conversation/root';
import {error as StoreEngineError} from '@wireapp/store-engine';
import {FileEngine} from '@wireapp/store-engine/dist/commonjs/engine';
import * as logdown from 'logdown';
import * as moment from 'moment';
import * as path from 'path';

import {Options, SubscriberOptions} from './interfaces';
import {TravisFeed} from './TravisFeed';

const {version}: {version: string} = require('../package.json');

class MainHandler extends MessageHandler {
  private readonly logger: logdown.Logger;
  private readonly STORE_PATH = path.join(__dirname, '.temp');
  private readonly TABLE_NAME = 'subscribers';
  private readonly storeEngine: FileEngine;
  private readonly travisFeed: TravisFeed;
  private readonly helpText = `**Hello!** 😎 This is Travis Status Bot v${version} speaking.\n\nAvailable commands:\n- /feed \n- /help\n- /subscribe\n`;

  constructor(options?: Options) {
    super();
    this.STORE_PATH = options && options.storePath ? path.resolve(options.storePath) : this.STORE_PATH;
    this.storeEngine = new FileEngine(this.STORE_PATH);
    this.travisFeed = new TravisFeed(options && options.feedUrl);
    this.logger = logdown('@wireapp/travis-status-bot/MainHandler', {
      logger: console,
      markdown: false,
    });
    this.logger.state.isEnabled = true;
  }

  public async init(): Promise<void> {
    await this.storeEngine.init('travis-status-bot', {
      fileExtension: '.dat',
    });
  }

  public handleEvent(payload: PayloadBundleIncoming) {
    switch (payload.type) {
      case PayloadBundleType.TEXT: {
        if (payload.conversation) {
          const messageContent = payload.content as TextContent;
          return this.handleText(payload.conversation, messageContent.text, payload.id);
        }
      }
      case PayloadBundleType.CONNECTION_REQUEST: {
        const connectRequest = payload.content as Connection;
        if (payload.conversation && connectRequest.status !== ConnectionStatus.CANCELLED) {
          return this.handleConnectionRequest(connectRequest.to, payload.conversation);
        }
      }
      default:
        return;
    }
  }

  public async handleText(conversationId: string, text: string, messageId: string): Promise<void> {
    switch (text) {
      case '/feed': {
        this.logger.info('Got command "/feed".');
        await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
        const {incidents} = await this.travisFeed.getFeed();
        let response = 'Here are the 5 latest feed entries:\n\n';
        if (incidents.length) {
          response = incidents.slice(0, 5).reduce((result, incident) => {
            const date = incident.created_at ? `${this.formatDate(incident.created_at)}: ` : '';
            const link = incident.shortlink ? ` (${incident.shortlink})` : '';
            return (result += `- ${date}"${incident.name}"${link}\n`);
          }, response);
        } else {
          response = 'No items found :(';
        }
        return this.sendText(conversationId, response);
      }
      case '/help': {
        this.logger.info('Got command "/help".');
        await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
        return this.sendText(conversationId, this.helpText);
      }
      case '/subscribe': {
        this.logger.info('Got command "/subscribe".');
        await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
        try {
          await this.addSubscriber(conversationId);
          return this.sendText(conversationId, 'You are successfully subscribed. To unsubscribe send "/unsubscribe".');
        } catch (error) {
          this.logger.error(error);
          return this.sendText(conversationId, 'Sorry, something went wrong :(');
        }
      }
      case '/subscribed': {
        this.logger.info('Got command "/subscribed".');
        await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
        try {
          const isSubscribed = await this.checkSubscription(conversationId);
          const answerText = isSubscribed
            ? 'You are currently subscribed. To unsubscribe send "/unsubscribe"'
            : 'You are currently unsubscribed. To re-subscribe send "/subscribe".';
          return this.sendText(conversationId, answerText);
        } catch (error) {
          this.logger.error(error);
          return this.sendText(conversationId, 'Sorry, something went wrong :(');
        }
      }
      case '/unsubscribe': {
        this.logger.info('Got command "/unsubscribe".');
        await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
        try {
          await this.removeSubscriber(conversationId);
          return this.sendText(conversationId, 'You are successfully unsubscribed. To re-subscribe send "/subscribe".');
        } catch (error) {
          this.logger.error(error);
          return this.sendText(conversationId, 'Sorry, something went wrong :(');
        }
      }
      case '/notify': {
        this.logger.info('Got command "/notify".');
        await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
        try {
          const notifiedIds = await this.notifySubscribers('Test notification');
          const answer = notifiedIds.length
            ? `Successfully notified ${notifiedIds.length} subscriber${notifiedIds.length === 1 ? '' : 's'}.`
            : 'Currently nobody is subscribed.';
          return this.sendText(conversationId, answer);
        } catch (error) {
          this.logger.error(error);
          return this.sendText(conversationId, 'Sorry, something went wrong :(');
        }
      }
      default: {
        if (text.startsWith('/')) {
          return this.sendText(conversationId, `Sorry, I don't know the command "${text}" yet.`);
        }
      }
    }
  }

  private async handleConnectionRequest(userId: string, conversationId: string): Promise<void> {
    await this.sendConnectionResponse(userId, true);
    await this.sendText(conversationId, this.helpText);
  }

  private formatDate(date: string | Date): string {
    return moment(date).format('DD.MM.YY');
  }

  private async addSubscriber(subscriberId: string): Promise<void> {
    await this.storeEngine.updateOrCreate(this.TABLE_NAME, subscriberId, {isSubscribed: true});
  }

  private async checkSubscription(conversationId: string): Promise<boolean> {
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

  private async removeSubscriber(conversationId: string): Promise<void> {
    await this.storeEngine.updateOrCreate(this.TABLE_NAME, conversationId, {isSubscribed: false});
  }

  private async notifySubscribers(message: string): Promise<string[]> {
    const conversationIds = await this.storeEngine.readAllPrimaryKeys(this.TABLE_NAME);
    const notifiedIds = [];

    for (const conversationId of conversationIds) {
      const isSubscribed = await this.checkSubscription(conversationId);
      if (isSubscribed) {
        await this.sendText(conversationId, message);
        notifiedIds.push(conversationId);
      }
    }

    return notifiedIds;
  }
}

export {MainHandler};
