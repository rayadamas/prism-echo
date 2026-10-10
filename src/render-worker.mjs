import {render, prepareEcho} from './engine.mjs?v=1.0.0';

// Canvas and file I/O stay in the UI; the reusable engine only consumes pixel arrays.
self.onmessage = ({data: job}) => {
  try {
    const {id, data, w, h, mask, config, echo, kind} = job;
    const fields = echo ?? prepareEcho(data, mask, w, h, config.smoothness);
    const result = render(data, w, h, mask, fields, config);
    const pixels = result[kind || 'output'];
    self.postMessage({id, pixels}, [pixels.buffer]);
  } catch (error) {
    self.postMessage({id: job.id, error: error.message || 'Could not render this image.'});
  }
};
