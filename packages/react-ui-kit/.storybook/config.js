import React from 'react';
import {configure, addDecorator} from '@storybook/react';
import {StyledApp} from '../src/Layout/StyledApp';

function loadStories() {
  require('../stories/misc.js');
  require('../stories/form.js');
}
addDecorator(story => <StyledApp>{story()}</StyledApp>);
configure(loadStories, module);
