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
  .option('-f, --file <URL>', 'Custom Travis JSON file')
  .option('-s, --store <path>', 'Custom store engine file path')
  .parse(process.argv);

const email = program.email || process.env.WIRE_EMAIL;
const password = program.password || process.env.WIRE_PASSWORD;

if (!password) {
  console.error('Error: No password given. Run with -p or set `WIRE_PASSWORD`.');
  program.outputHelp();
  process.exit(1);
}

if (!email) {
  console.error('Error: No email given. Run with -e or set `WIRE_EMAIL`.');
  program.outputHelp();
  process.exit(1);
}

const bot = new Bot({email, password});

const customDataURL: string | undefined = program.file || process.env.TRAVIS_DATA_URL;
const customStorePath: string | undefined = program.store || process.env.STORE_PATH;

const mainHandler = new MainHandler({
  ...(customDataURL && {dataUrl: customDataURL}),
  ...(customStorePath && {storePath: customStorePath}),
});

mainHandler
  .init()
  .then(() => {
    bot.addHandler(mainHandler);
    return bot.start();
  })
  .catch(error => {
    console.error('error', error);
    process.exit(1);
  });
