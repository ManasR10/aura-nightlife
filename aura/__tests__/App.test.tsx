import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('App renders without crashing', async () => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
  });
});
