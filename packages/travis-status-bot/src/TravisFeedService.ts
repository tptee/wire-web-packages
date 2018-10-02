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

import axios from 'axios';
import {CronJob} from 'cron';
import * as logdown from 'logdown';

import {TravisIncident, TravisStatus} from './interfaces';
import {StoreService} from './StoreService';

const defaultFeedUrl = 'https://www.traviscistatus.com/index.json';

class TravisFeedService {
  private readonly logger: logdown.Logger;
  private readonly FEED_URL: string;

  constructor(
    private readonly storeService: StoreService,
    private readonly notifySubscribers: ((incidents: TravisIncident[]) => Promise<void>),
    feedUrl?: string
  ) {
    this.FEED_URL = feedUrl || defaultFeedUrl;

    this.logger = logdown('@wireapp/travis-status-bot/TravisFeedService', {
      logger: console,
      markdown: false,
    });
    this.logger.state.isEnabled = true;
  }

  public async init(): Promise<void> {
    await new CronJob('*/1', () => this.updateFeed());
  }

  public async getFeed(): Promise<TravisStatus> {
    await this.updateFeed();
    return this.storeService.getFeedData();
  }

  private async getNewIncidents(data: TravisStatus): Promise<TravisIncident[] | null> {
    if (!data.incidents || !data.incidents.length) {
      return null;
    }

    const cachedData = await this.storeService.getFeedData();
    const cachedIncidents = cachedData.incidents;

    if (!cachedIncidents || !cachedIncidents.length) {
      return data.incidents;
    }

    const newIncidents = data.incidents.filter(dataIncident =>
      cachedIncidents.some(cachedIncident => cachedIncident.id === dataIncident.id)
    );
    return newIncidents.length ? newIncidents : null;
  }

  public async updateFeed(): Promise<void> {
    const feedData = await this.requestFeedData();
    const newIncidents = await this.getNewIncidents(feedData);
    await this.storeService.updateFeedData(feedData);
    this.logger.info('Updated Travis feed.');

    if (newIncidents) {
      await this.notifySubscribers(newIncidents);
    }
  }

  private async requestFeedData(): Promise<TravisStatus> {
    const {data} = await axios.get<TravisStatus>(this.FEED_URL);
    this.logger.info(`Got ${data.incidents.length} incidents and ${data.components.length} components.`);
    return data;
  }
}

export {TravisFeedService};
