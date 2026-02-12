import * as React from 'react';
import renderer from 'react-test-renderer';

import { MonoText } from '../StyledText';

it(`renders correctly`, () => {
  const tree = renderer.create(React.createElement(MonoText, null, 'Snapshot test!')).toJSON();

  expect(tree).toMatchSnapshot();
});
