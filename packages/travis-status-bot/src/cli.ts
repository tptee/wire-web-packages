#!/usr/bin/env node

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

process.on('uncaughtException', error => console.error(`Uncaught exception: ${error.message}`, error));
process.on('unhandledRejection', error =>
  console.error(`Uncaught rejection "${error.constructor.name}": ${error.message}`, error)
);

import {Bot} from '@wireapp/bot-api';
import * as program from 'commander';
import {MainHandler} from './TravisStatusBot';

if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
}

const {description, name, version}: {description: string; name: string; version: string} = require('../package.json');

program
  .name(name.replace(/^@[^/]+\//, ''))
  .version(version, '-v, --version')
  .description(description)
  .option('-e, --email <email>', 'Your email address')
  .option('-m, --message <message>', 'Custom message')
  .option('-p, --password <password>', 'Your password')
  .option('-f, --feed <URL>', 'Custom Travis JSON file')
  .option('-s, --store <path>', 'Custom store engine file path')
  .parse(process.argv);

const bot = new Bot({
  email: program.email || process.env.WIRE_EMAIL,
  password: program.password || process.env.WIRE_PASSWORD,
});

const customFeedURL: string | undefined = program.feed || process.env.TRAVIS_FEED_URL;
const customStorePath: string | undefined = program.feed || process.env.STORE_PATH;

const mainHandler = new MainHandler({
  ...(customFeedURL && {feedUrl: customFeedURL}),
  ...(customStorePath && {storePath: customStorePath}),
});

mainHandler
  .init()
  .then(() => {
    bot.addHandler(mainHandler);
    return bot.start();
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
