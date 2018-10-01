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

//import * as path from 'path';
//import {FileEngine} from '@wireapp/store-engine';
import {MessageHandler} from '@wireapp/bot-api';
import {PayloadBundleIncoming, PayloadBundleType, ReactionType} from '@wireapp/core/dist/conversation/root';
import * as logdown from 'logdown';

import {Connection, ConnectionStatus} from '@wireapp/api-client/dist/commonjs/connection';
import {TextContent} from '@wireapp/core/dist/conversation/content';
import {Options} from './interfaces';
import {TravisFeed} from './TravisFeed';

const {version}: {version: string} = require('../package.json');

class MainHandler extends MessageHandler {
  private readonly logger: logdown.Logger;
  //private readonly STORE_PATH = path.resolve(__dirname, '.temp');
  //private readonly storeEngine: FileEngine;
  private readonly travisFeed: TravisFeed;
  private readonly helpText = `**Hello!** 😎 This is Travis Status Bot v${version} speaking.\n\nAvailable commands:\n- /feed \n- /help\n- /subscribe\n`;

  constructor(options?: Options) {
    super();
    //this.storeEngine = new FileEngine(this.STORE_PATH);
    this.travisFeed = new TravisFeed(options);
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
          return this.handleText(payload.conversation, messageContent.text, payload.id, payload.from);
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

  public async handleText(conversationId: string, text: string, messageId: string, senderId: string): Promise<void> {
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
        return this.sendText(conversationId, 'Not yet implemented :(');
      }
    }
  }

  async handleConnectionRequest(userId: string, conversationId: string): Promise<void> {
    await this.sendConnectionResponse(userId, true);
    await this.sendText(conversationId, this.helpText);
  }

  private formatDate(date: string): string {
    const formatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    };
    return new Date(date).toLocaleDateString('en-UK', formatOptions);
  }
}

export {MainHandler};
