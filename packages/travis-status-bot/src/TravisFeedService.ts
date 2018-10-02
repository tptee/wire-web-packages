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
    await this.updateFeed();

    const cronJobTime = '*/1';
    new CronJob(cronJobTime, () => this.updateFeed()).start();
    this.logger.info(`Initialized cron job with time: "${cronJobTime}".`);
  }

  public async getFeed(): Promise<TravisStatus | null> {
    await this.updateFeed();
    const cachedFeedData = this.storeService.loadFeedFromCache();
    if (!cachedFeedData) {
      this.logger.info('Not feed data loaded from cache.');
    }
    return cachedFeedData;
  }

  private async getNewIncidents(oldData: TravisStatus, newData: TravisStatus): Promise<TravisIncident[] | null> {
    if (!newData.incidents || !newData.incidents.length) {
      this.logger.info('!newData.incidents || !newData.incidents.length');
      return null;
    }

    if (!oldData.incidents || !oldData.incidents.length) {
      return newData.incidents;
    }

    const cachedIncidents = oldData.incidents;

    if (!cachedIncidents || !cachedIncidents.length) {
      return newData.incidents;
    }

    const newIncidents = newData.incidents.filter(dataIncident =>
      cachedIncidents.some(cachedIncident => cachedIncident.id === dataIncident.id)
    );
    return newIncidents.length ? newIncidents : null;
  }

  public async updateFeed(): Promise<TravisStatus | null> {
    const feedData = await this.requestFeedData();
    const cachedData = await this.storeService.loadFeedFromCache();

    if (!feedData) {
      this.logger.info(`Did not save Travis feed to cache.`);
      return cachedData || null;
    }

    await this.storeService.saveFeedToCache(feedData);

    let newIncidents: TravisIncident[] | null = null;

    if (cachedData) {
      newIncidents = await this.getNewIncidents(cachedData, feedData);
    }

    this.logger.info(`Saved Travis feed to cache. Got ${newIncidents ? newIncidents.length : 'no'} new incidents.`);

    if (newIncidents) {
      await this.notifySubscribers(newIncidents);
    }

    return feedData;
  }

  private async requestFeedData(): Promise<TravisStatus | null> {
    try {
      const {data} = await axios.get<TravisStatus>(this.FEED_URL);
      this.logger.info(
        `Received ${data.incidents.length} incidents and ${data.components.length} components from ${this.FEED_URL}.`
      );
      return data;
    } catch (error) {
      this.logger.error(`Request to "${error.config.url}" failed with status code "${error.response.status}".`);
      return null;
    }
  }
}

export {TravisFeedService};
