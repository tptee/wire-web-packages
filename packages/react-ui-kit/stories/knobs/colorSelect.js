import {COLOR} from '@wireapp/react-ui-kit/src/Identity/colors';
import {selectV2} from '@storybook/addon-knobs';

const options = {};

const baseColors = ['BLUE', 'GRAY', 'GREEN', 'ORANGE', 'RED', 'YELLOW'];
const additionalColors = ['WHITE', 'BLACK', 'LINK', 'TEXT', 'ICON', 'DISABLED'];
const allColors = [...baseColors, ...additionalColors];
const steps = [];
const percent = 100;
const stepSize = 8;

for (let index = stepSize; index < percent; index += stepSize) {
  steps.push(index);
}
allColors.forEach(name => (options[name] = COLOR[name]));
baseColors.forEach(name =>
  steps.forEach(step => {
    const colorName = `${name}_DARKEN_${step}`;
    options[colorName] = COLOR[colorName];
  })
);
baseColors.forEach(name =>
  steps.forEach(step => {
    const colorName = `${name}_LIGHTEN_${step}`;
    options[colorName] = COLOR[colorName];
  })
);
baseColors.forEach(name =>
  steps.forEach(step => {
    const colorName = `${name}_OPAQUE_${step}`;
    options[colorName] = COLOR[colorName];
  })
);

const defaultValue = COLOR.BLUE;

export const colorSelect = (label = 'Color', group) => selectV2(label, options, defaultValue, group);
