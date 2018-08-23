import {Loading, PILL_TYPE, Pill} from '../src';
import {boolean, number, withKnobs} from '@storybook/addon-knobs';
import React from 'react';
import {storiesOf} from '@storybook/react';

/* eslint-disable no-magic-numbers, sort-keys */

const stories = storiesOf('Misc', module);
stories.addDecorator(withKnobs);

stories.add('Loading Spinner', () => {
  const skipProgress = boolean('Default progress', true);
  const progress = skipProgress ? undefined : number('Progress', 0.33, {range: true, min: 0, max: 1, step: 0.01});

  const skipSize = boolean('Default size', true);
  const size = skipSize ? undefined : number('Size', 43, {range: true, min: 16, max: 128, step: 1});

  return <Loading progress={progress} size={size} />;
});

class PillDemo extends React.PureComponent {
  constructor() {
    super();
    this.state = {
      firstActive: true,
    };
  }
  render() {
    const {firstActive} = this.state;
    return (
      <div>
        <Pill
          style={{cursor: firstActive ? 'auto' : 'pointer'}}
          active={firstActive}
          onClick={() => this.setState({firstActive: true})}
        >
          Click Me
        </Pill>
        <Pill
          style={{cursor: firstActive ? 'pointer' : 'auto'}}
          active={!firstActive}
          onClick={() => this.setState({firstActive: false})}
        >
          Or Me
        </Pill>
      </div>
    );
  }
}

stories.add('Pills', () => (
  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '16px'}}>
    <PillDemo />
    <Pill type={PILL_TYPE.success}>PILL_TYPE.success</Pill>
    <Pill type={PILL_TYPE.warning}>PILL_TYPE.warning</Pill>
    <Pill type={PILL_TYPE.error}>PILL_TYPE.error</Pill>
  </div>
));
