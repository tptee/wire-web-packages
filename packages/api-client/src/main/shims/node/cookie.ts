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
import {CRUDEngine} from '@wireapp/store-engine/dist/commonjs/engine';
import {AxiosRequestConfig, AxiosResponse} from 'axios';
import * as logdown from 'logdown';
import {Cookie as ToughCookie} from 'tough-cookie';
import {AUTH_COOKIE_KEY, AUTH_TABLE_NAME, AccessTokenData, Cookie} from '../../auth';
import {HttpClient} from '../../http';

interface PersistedCookie {
  expiration: string;
  zuid: string;
}

const logger = logdown('@wireapp/api-client/shims/node/cookie', {
  logger: console,
  markdown: false,
});

function loadExistingCookie(engine: CRUDEngine): Promise<Cookie> {
  return engine
    .read<PersistedCookie>(AUTH_TABLE_NAME, AUTH_COOKIE_KEY)
    .catch((error: Error) => {
      if (
        error instanceof StoreEngineError.RecordNotFoundError ||
        error.constructor.name === StoreEngineError.RecordNotFoundError.name
      ) {
        return new Cookie('', '0');
      }

      throw error;
    })
    .then((fileContent: PersistedCookie) => {
      return typeof fileContent === 'object'
        ? new Cookie(fileContent.zuid, fileContent.expiration)
        : new Cookie('', '0');
    });
}

function setInternalCookie(cookie: Cookie, engine: CRUDEngine): Promise<string> {
  const entity: PersistedCookie = {expiration: cookie.expiration, zuid: cookie.zuid};
  return engine.create(AUTH_TABLE_NAME, AUTH_COOKIE_KEY, entity).catch(error => {
    if (
      error instanceof StoreEngineError.RecordAlreadyExistsError ||
      error.constructor.name === StoreEngineError.RecordAlreadyExistsError.name
    ) {
      return engine.update(AUTH_TABLE_NAME, AUTH_COOKIE_KEY, entity);
    } else {
      throw error;
    }
  });
}

export async function saveCookie(response: AxiosResponse, cookieStore: CRUDEngine): Promise<AccessTokenData> {
  if (response.headers && response.headers['set-cookie']) {
    const cookies: string[] | string = response.headers['set-cookie'];
    const parsedCookies =
      cookies instanceof Array ? cookies.map(cookie => ToughCookie.parse(cookie)) : [ToughCookie.parse(cookies)];
    for (const cookie of parsedCookies) {
      if (cookie) {
        await setInternalCookie(new Cookie(cookie.value, cookie.expires.toString()), cookieStore);
        logger.info(`Saved internal cookie.`, {...cookie, value: `${cookie.value.substr(0, 20)}...`});
      }
    }
  }

  return response.data;
}

// https://github.com/wearezeta/backend-api-docs/wiki/API-User-Authentication#token-refresh
export async function sendRequestWithCookie(
  client: HttpClient,
  config: AxiosRequestConfig,
  engine: CRUDEngine
): Promise<AxiosResponse> {
  return loadExistingCookie(engine).then((cookie: Cookie) => {
    if (!cookie.isExpired) {
      config.headers = config.headers || {};
      config.headers['Cookie'] = `zuid=${cookie.zuid}`;
      config.withCredentials = true;
    }

    return client._sendRequest(config);
  });
}
