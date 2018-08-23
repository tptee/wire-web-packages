import {boolean, withKnobs} from '@storybook/addon-knobs';
import {Button} from '@wireapp/react-ui-kit/src/Form/Button';
import React from 'react';
import {colorSelect} from '@wireapp/react-ui-kit/stories/knobs/colorSelect';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

const stories = storiesOf('Form', module);
stories.addDecorator(withKnobs);

stories.add(
  'Button',
  withInfo('A simple Button Component')(() => {
    const useDefaultBG = boolean('Default background color', true, 'Background Color');
    const bgColor = useDefaultBG ? undefined : colorSelect('Background color', 'Background Color');
    return <Button backgroundColor={bgColor}>I am a Button</Button>;
  })
);
