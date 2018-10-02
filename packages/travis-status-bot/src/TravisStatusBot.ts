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
import * as logdown from 'logdown';
import * as moment from 'moment';

import {Options} from './interfaces';
import {StoreService} from './StoreService';
import {TravisFeedService} from './TravisFeedService';

const {version}: {version: string} = require('../package.json');

class MainHandler extends MessageHandler {
  private readonly helpText = `**Hello!** 😎 This is Travis Status Bot v${version} speaking.\n\nAvailable commands:\n- /feed \n- /help\n- /subscribe\n- /subscribed\n- /unsubscribe`;
  private readonly logger: logdown.Logger;
  private readonly travisFeedService: TravisFeedService;
  private readonly storeService: StoreService;

  constructor(options?: Options) {
    super();
    this.travisFeedService = new TravisFeedService(options && options.feedUrl);
    this.storeService = new StoreService(options && options.storePath);
    this.logger = logdown('@wireapp/travis-status-bot/MainHandler', {
      logger: console,
      markdown: false,
    });
    this.logger.state.isEnabled = true;
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

  public async init(): Promise<void> {
    await this.storeService.init();
  }

  private formatDate(date: string | Date): string {
    return moment(date).format('DD.MM.YY');
  }

  private async handleCommandFeed(conversationId: string, messageId: string): Promise<void> {
    await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
    const {incidents} = await this.travisFeedService.getFeed();
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

  private async handleCommandHelp(conversationId: string, messageId: string): Promise<void> {
    await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
    return this.sendText(conversationId, this.helpText);
  }

  private async handleCommandSubscribe(conversationId: string, messageId: string): Promise<void> {
    await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
    try {
      await this.storeService.addSubscriber(conversationId);
      return this.sendText(conversationId, 'You are successfully subscribed. To unsubscribe send "/unsubscribe".');
    } catch (error) {
      this.logger.error(error);
      return this.sendText(conversationId, 'Sorry, something went wrong :(');
    }
  }

  private async handleCommandSubscribed(conversationId: string, messageId: string): Promise<void> {
    await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
    try {
      const isSubscribed = await this.storeService.checkSubscription(conversationId);
      const answerText = isSubscribed
        ? 'You are currently subscribed. To unsubscribe send "/unsubscribe"'
        : 'You are currently unsubscribed. To re-subscribe send "/subscribe".';
      return this.sendText(conversationId, answerText);
    } catch (error) {
      this.logger.error(error);
      return this.sendText(conversationId, 'Sorry, something went wrong :(');
    }
  }

  private async handleCommandUnsubscribe(conversationId: string, messageId: string): Promise<void> {
    await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
    try {
      await this.storeService.removeSubscriber(conversationId);
      return this.sendText(conversationId, 'You are successfully unsubscribed. To re-subscribe send "/subscribe".');
    } catch (error) {
      this.logger.error(error);
      return this.sendText(conversationId, 'Sorry, something went wrong :(');
    }
  }

  private async handleConnectionRequest(userId: string, conversationId: string): Promise<void> {
    await this.sendConnectionResponse(userId, true);
    await this.sendText(conversationId, this.helpText);
  }

  public async handleText(conversationId: string, rawText: string, messageId: string): Promise<void> {
    switch (rawText) {
      case '/feed': {
        this.logger.info('Received command "/feed".');
        return this.handleCommandFeed(conversationId, messageId);
      }
      case '/help': {
        this.logger.info('Received command "/help".');
        return this.handleCommandHelp(conversationId, messageId);
      }
      case '/subscribe': {
        this.logger.info('Received command "/subscribe".');
        return this.handleCommandSubscribe(conversationId, messageId);
      }
      case '/subscribed': {
        this.logger.info('Received command "/subscribed".');
        return this.handleCommandSubscribed(conversationId, messageId);
      }
      case '/unsubscribe': {
        this.logger.info('Received command "/unsubscribe".');
        return this.handleCommandUnsubscribe(conversationId, messageId);
      }
      case '/notify': {
        this.logger.info('Received command "/notify".');
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
        if (rawText.startsWith('/')) {
          return this.sendText(conversationId, `Sorry, I don't know the command "${rawText}" yet.`);
        }
      }
    }
  }

  private async notifySubscribers(message: string): Promise<string[]> {
    const conversationIds = await this.storeService.getSubscribers();

    for (const conversationId of conversationIds) {
      await this.sendText(conversationId, message);
    }

    return conversationIds;
  }
}

export {MainHandler};
