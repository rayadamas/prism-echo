import {render, prepareEcho} from './engine.mjs?v=1.0.0';

export function createRenderer() {
  let worker;
  let nextId = 0;
  const jobs = new Map();
  const disable = () => {
    worker?.terminate(); worker = undefined;
    for (const {reject} of jobs.values()) reject(new Error('Rendering was interrupted. Try again.'));
    jobs.clear();
  };
  try {
    worker = new Worker(new URL('./render-worker.mjs', import.meta.url), {type: 'module'});
    worker.onmessage = ({data: {id, pixels, error}}) => {
      const job = jobs.get(id); if (!job) return; jobs.delete(id);
      if (error) job.reject(new Error(error)); else job.resolve(pixels);
    };
    worker.onerror = disable;
    worker.onmessageerror = disable;
  } catch { /* Older browsers can still use the synchronous engine. */ }
  return job => {
    if (!worker) return Promise.resolve().then(() => {
      const fields = job.echo ?? prepareEcho(job.data, job.mask, job.w, job.h, job.config.smoothness);
      return render(job.data, job.w, job.h, job.mask, fields, job.config)[job.kind || 'output'];
    });
    return new Promise((resolve, reject) => {
      const id = ++nextId; jobs.set(id, {resolve, reject});
      try { worker.postMessage({...job, id}); }
      catch (error) { jobs.delete(id); reject(error); }
    });
  };
}
