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

import {TravisIncident, TravisStatus} from './Interfaces';
import {StoreService} from './StoreService';

const defaultDataUrl = 'https://www.traviscistatus.com/index.json';

class TravisNotificationService {
  private readonly logger: logdown.Logger;
  private readonly DATA_URL: string;
  private readonly storeService: StoreService;
  private readonly notifySubscribers: ((incidents: TravisIncident[]) => Promise<void>);

  constructor(
    storeService: StoreService,
    notifySubscribers: ((incidents: TravisIncident[]) => Promise<void>),
    dataUrl?: string
  ) {
    this.storeService = storeService;
    this.notifySubscribers = notifySubscribers;
    this.DATA_URL = dataUrl || defaultDataUrl;

    this.logger = logdown('@wireapp/travis-status-bot/TravisNotificationService', {
      logger: console,
      markdown: false,
    });
    this.logger.state.isEnabled = true;
  }

  public async init(): Promise<void> {
    await this.updateData();

    const cronJobTime = '*/1';
    new CronJob(cronJobTime, () => this.updateData()).start();
    this.logger.info(`Initialized cron updater job with time: "${cronJobTime}".`);
  }

  public async getStatus(): Promise<TravisStatus | null> {
    await this.updateData();

    const cachedJSONData = this.storeService.loadDataFromCache();

    if (!cachedJSONData) {
      this.logger.info('No Travis JSON data found in cache.');
    }

    return cachedJSONData;
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

  public async updateData(): Promise<TravisStatus | null> {
    const jsonData = await this.requestJSONData();
    const cachedData = await this.storeService.loadDataFromCache();

    if (!jsonData) {
      this.logger.info(`Did not save any Travis JSON data to cache.`);
      return cachedData || null;
    }

    await this.storeService.saveDataToCache(jsonData);

    let newIncidents: TravisIncident[] | null = null;

    if (cachedData) {
      newIncidents = await this.getNewIncidents(cachedData, jsonData);
    }

    this.logger.info(
      `Saved Travis JSON data to cache. Got ${newIncidents ? newIncidents.length : 'no'} new incidents.`
    );

    if (newIncidents) {
      await this.notifySubscribers(newIncidents);
    }

    return jsonData;
  }

  private async requestJSONData(): Promise<TravisStatus | null> {
    try {
      const {data} = await axios.get<TravisStatus>(this.DATA_URL);
      this.logger.info(
        `Received ${data.incidents.length} incidents and ${data.components.length} components from ${this.DATA_URL}.`
      );
      return data;
    } catch (error) {
      this.logger.error(`Request to "${error.config.url}" failed with status code "${error.response.status}".`);
      return null;
    }
  }
}

export {TravisNotificationService};
