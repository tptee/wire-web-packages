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

import axios, {AxiosResponse} from 'axios';
import * as FeedParser from 'feedparser';
import * as logdown from 'logdown';
import {Stream} from 'stream';

import {Options} from './interfaces';

const defaultConfig: Required<Options> = {
  feedUrl: 'https://www.traviscistatus.com/history.rss',
};

class TravisRSSFeed {
  private readonly config: Required<Options>;
  private readonly feedParser: FeedParser;
  private readonly logger: logdown.Logger;

  constructor(options?: Options) {
    this.config = {
      ...defaultConfig,
      ...options,
    };

    this.logger = logdown('@wireapp/travis-status-bot/TravisRSSFeed', {
      logger: console,
      markdown: false,
    });

    this.feedParser = new FeedParser({});
    this.feedParser.on('error', (error: Error) => {
      this.logger.error(error);
    });
  }

  private request(): Promise<AxiosResponse<Stream>> {
    return axios.request({
      responseType: 'stream',
      url: this.config.feedUrl,
    });
  }

  getFeed(): Promise<FeedParser.Item[]> {
    const items: FeedParser.Item[] = [];

    return this.request().then(stream => {
      stream.data.pipe(this.feedParser);

      return new Promise(resolve => {
        this.feedParser.on('readable', () => {
          let item: FeedParser.Item;

          while ((item = this.feedParser.read())) {
            items.push(item);
          }
        });

        this.feedParser.on('end', () => resolve(items));
      });
    }) as Promise<FeedParser.Item[]>;
  }
}

export {TravisRSSFeed};
